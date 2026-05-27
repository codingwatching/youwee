use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::process::Command;
use tokio::sync::oneshot;

use crate::utils::CommandExt;

use super::security_policy::{
    validate_command_path, validate_plugin_output_path, validate_plugin_write_scope,
    validate_tool_arg,
};

const MAX_BRIDGE_BODY_BYTES: usize = 32 * 1024 * 1024;
const STRIP_SUBPROCESS_ENV_KEYS: &[&str] = &[
    "DYLD_FALLBACK_LIBRARY_PATH",
    "DYLD_LIBRARY_PATH",
    "LD_LIBRARY_PATH",
];

#[derive(Clone)]
pub(super) struct PluginBridgePolicy {
    pub(super) allow_read_scopes: Vec<PathBuf>,
    pub(super) allow_write_scopes: Vec<PathBuf>,
    pub(super) plugin_dir: PathBuf,
    pub(super) ffmpeg_path: Option<PathBuf>,
    pub(super) ytdlp_path: Option<PathBuf>,
}

pub(super) struct PluginBridgeServer {
    url: String,
    token: String,
    tools: Vec<String>,
    shutdown: Option<oneshot::Sender<()>>,
}

impl PluginBridgeServer {
    pub(super) fn url(&self) -> &str {
        &self.url
    }

    pub(super) fn token(&self) -> &str {
        &self.token
    }

    pub(super) fn tools_csv(&self) -> String {
        self.tools.join(",")
    }
}

impl Drop for PluginBridgeServer {
    fn drop(&mut self) {
        if let Some(shutdown) = self.shutdown.take() {
            let _ = shutdown.send(());
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FsPathRequest {
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FsWriteTextRequest {
    path: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FsTempDirRequest {
    prefix: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolRunRequest {
    tool: String,
    args: Vec<String>,
    cwd: Option<String>,
    env: Option<BTreeMap<String, String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeResponse<T: Serialize> {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolRunResponse {
    code: Option<i32>,
    signal: Option<String>,
    stdout: String,
    stderr: String,
}

pub(super) async fn start_plugin_bridge(
    token: String,
    policy: PluginBridgePolicy,
) -> Result<PluginBridgeServer, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Failed to start plugin bridge: {e}"))?;
    let addr = listener
        .local_addr()
        .map_err(|e| format!("Failed to resolve plugin bridge address: {e}"))?;
    let (shutdown_tx, mut shutdown_rx) = oneshot::channel::<()>();
    let policy = Arc::new(policy);
    let server_token = token.clone();
    let tools = {
        let mut values = Vec::new();
        if policy.ffmpeg_path.is_some() {
            values.push("ffmpeg".to_string());
        }
        if policy.ytdlp_path.is_some() {
            values.push("ytdlp".to_string());
        }
        values
    };

    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = &mut shutdown_rx => break,
                accepted = listener.accept() => {
                    let Ok((stream, _)) = accepted else {
                        continue;
                    };
                    let policy = policy.clone();
                    let token = server_token.clone();
                    tokio::spawn(async move {
                        let _ = handle_bridge_connection(stream, &token, policy).await;
                    });
                }
            }
        }
    });

    Ok(PluginBridgeServer {
        url: format!("http://{}", addr),
        token,
        tools,
        shutdown: Some(shutdown_tx),
    })
}

async fn handle_bridge_connection(
    mut stream: TcpStream,
    token: &str,
    policy: Arc<PluginBridgePolicy>,
) -> Result<(), String> {
    let mut buffer = Vec::new();
    let mut headers_end = None;
    loop {
        let mut chunk = [0_u8; 4096];
        let read = stream
            .read(&mut chunk)
            .await
            .map_err(|e| format!("Failed to read plugin bridge request: {e}"))?;
        if read == 0 {
            return Ok(());
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.len() > MAX_BRIDGE_BODY_BYTES {
            write_json_response::<serde_json::Value>(
                &mut stream,
                413,
                None,
                Some("Request too large"),
            )
            .await?;
            return Ok(());
        }
        if headers_end.is_none() {
            headers_end = find_headers_end(&buffer);
        }
        if let Some(end) = headers_end {
            let content_length = parse_content_length(&buffer[..end])?;
            let total = end + 4 + content_length;
            if buffer.len() >= total {
                let body = buffer[end + 4..total].to_vec();
                let status = handle_bridge_request(token, policy, &buffer[..end], body)
                    .await
                    .unwrap_or_else(|error| (400, None, Some(error)));
                write_json_response::<serde_json::Value>(
                    &mut stream,
                    status.0,
                    status.1,
                    status.2.as_deref(),
                )
                .await?;
                return Ok(());
            }
        }
    }
}

async fn handle_bridge_request(
    token: &str,
    policy: Arc<PluginBridgePolicy>,
    headers: &[u8],
    body: Vec<u8>,
) -> Result<(u16, Option<serde_json::Value>, Option<String>), String> {
    let header_text = String::from_utf8_lossy(headers);
    let mut lines = header_text.lines();
    let request_line = lines
        .next()
        .ok_or_else(|| "Missing request line".to_string())?;
    let mut request_parts = request_line.split_whitespace();
    let method = request_parts.next().unwrap_or_default();
    let path = request_parts.next().unwrap_or_default();
    if method != "POST" {
        return Ok((
            405,
            None,
            Some("Plugin bridge only accepts POST requests.".to_string()),
        ));
    }
    if !has_valid_auth(&header_text, token) {
        return Ok((401, None, Some("Invalid plugin bridge token.".to_string())));
    }

    match path {
        "/fs/exists" => {
            let request: FsPathRequest = parse_body(&body)?;
            let path = PathBuf::from(request.path);
            validate_read_path(&policy, &path)?;
            Ok((200, Some(serde_json::json!(path.exists())), None))
        }
        "/fs/readText" => {
            let request: FsPathRequest = parse_body(&body)?;
            let path = PathBuf::from(request.path);
            validate_read_path(&policy, &path)?;
            let content = tokio::fs::read_to_string(&path)
                .await
                .map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
            Ok((200, Some(serde_json::json!(content)), None))
        }
        "/fs/writeText" => {
            let request: FsWriteTextRequest = parse_body(&body)?;
            let path = PathBuf::from(request.path);
            validate_write_path(&policy, &path)?;
            tokio::fs::write(&path, request.content)
                .await
                .map_err(|e| format!("Failed to write {}: {e}", path.display()))?;
            Ok((200, Some(serde_json::Value::Null), None))
        }
        "/fs/ensureDir" => {
            let request: FsPathRequest = parse_body(&body)?;
            let path = PathBuf::from(request.path);
            validate_write_scope_path(&policy, &path)?;
            tokio::fs::create_dir_all(&path)
                .await
                .map_err(|e| format!("Failed to create {}: {e}", path.display()))?;
            Ok((200, Some(serde_json::Value::Null), None))
        }
        "/fs/tempDir" => {
            let request: FsTempDirRequest = parse_body(&body)?;
            let prefix = request
                .prefix
                .unwrap_or_else(|| "youwee-plugin-".to_string());
            let path = plugin_temp_dir_path(&prefix);
            validate_write_scope_path(&policy, &path)?;
            tokio::fs::create_dir_all(&path)
                .await
                .map_err(|e| format!("Failed to create plugin temp directory: {e}"))?;
            Ok((200, Some(serde_json::json!(path.to_string_lossy())), None))
        }
        "/tool/run" => {
            let request: ToolRunRequest = parse_body(&body)?;
            let response = run_tool(policy, request).await?;
            Ok((
                200,
                Some(serde_json::to_value(response).unwrap_or_default()),
                None,
            ))
        }
        _ => Ok((
            404,
            None,
            Some("Unknown plugin bridge operation.".to_string()),
        )),
    }
}

fn parse_body<T: for<'de> Deserialize<'de>>(body: &[u8]) -> Result<T, String> {
    serde_json::from_slice(body).map_err(|e| format!("Invalid plugin bridge JSON: {e}"))
}

async fn run_tool(
    policy: Arc<PluginBridgePolicy>,
    request: ToolRunRequest,
) -> Result<ToolRunResponse, String> {
    let command_path = match request.tool.as_str() {
        "ffmpeg" => policy.ffmpeg_path.as_ref(),
        "ytdlp" => policy.ytdlp_path.as_ref(),
        _ => None,
    }
    .ok_or_else(|| {
        format!(
            "Plugin tool is not approved or unavailable: {}",
            request.tool
        )
    })?;
    validate_command_path(command_path)?;
    let cwd = request
        .cwd
        .as_ref()
        .filter(|value| !value.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| policy.plugin_dir.clone());
    validate_working_directory_path(&policy, &cwd)?;
    validate_tool_args_with_policy(&policy, &request.tool, &request.args, &cwd)?;

    let mut command = Command::new(command_path);
    command
        .args(&request.args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    command.hide_window();

    command.current_dir(cwd);

    command.env_clear();
    if let Some(env) = request.env.as_ref() {
        for (key, value) in env {
            if !STRIP_SUBPROCESS_ENV_KEYS.contains(&key.as_str()) {
                command.env(key, value);
            }
        }
    }

    let output = tokio::time::timeout(Duration::from_secs(60 * 30), command.output())
        .await
        .map_err(|_| format!("Plugin tool timed out: {}", request.tool))?
        .map_err(|e| format!("Failed to run plugin tool {}: {e}", request.tool))?;

    Ok(ToolRunResponse {
        code: output.status.code(),
        signal: None,
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

fn validate_tool_args_with_policy(
    policy: &PluginBridgePolicy,
    tool_name: &str,
    args: &[String],
    cwd: &Path,
) -> Result<(), String> {
    let mut previous_arg = "";
    let mut last_path_candidate: Option<PathBuf> = None;
    for arg in args {
        validate_tool_arg(tool_name, arg)?;
        if let Some((name, value)) = arg.split_once('=') {
            if matches!(name, "-o" | "--output") && is_local_path_candidate(value) {
                validate_write_path(policy, &resolve_arg_path(cwd, value))?;
            }
        }
        if is_local_path_candidate(arg) {
            let path = resolve_arg_path(cwd, arg);
            if previous_arg == "-i" || previous_arg == "--input" {
                validate_read_path(policy, &path)?;
            } else if previous_arg == "-o" || previous_arg == "--output" {
                validate_write_path(policy, &path)?;
            } else {
                last_path_candidate = Some(path);
            }
        }
        previous_arg = arg;
    }

    if let Some(output) = last_path_candidate.as_ref() {
        validate_write_path(policy, output)?;
    }
    Ok(())
}

fn resolve_arg_path(cwd: &Path, value: &str) -> PathBuf {
    let path = PathBuf::from(value.strip_prefix("file:").unwrap_or(value));
    if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    }
}

fn validate_read_path(policy: &PluginBridgePolicy, path: &Path) -> Result<(), String> {
    if !path_within_scopes(path, &policy.allow_read_scopes) {
        return Err(format!(
            "Plugin read path is outside approved scopes: {}",
            path.display()
        ));
    }
    Ok(())
}

fn validate_working_directory_path(policy: &PluginBridgePolicy, path: &Path) -> Result<(), String> {
    if !path_within_scopes(path, &policy.allow_read_scopes)
        && !path_within_scopes(path, &policy.allow_write_scopes)
    {
        return Err(format!(
            "Plugin tool working directory is outside approved scopes: {}",
            path.display()
        ));
    }
    Ok(())
}

fn validate_write_path(policy: &PluginBridgePolicy, path: &Path) -> Result<(), String> {
    validate_plugin_output_path(path)?;
    if !path_within_scopes(path, &policy.allow_write_scopes) {
        return Err(format!(
            "Plugin write path is outside approved scopes: {}",
            path.display()
        ));
    }
    Ok(())
}

fn validate_write_scope_path(policy: &PluginBridgePolicy, path: &Path) -> Result<(), String> {
    validate_plugin_write_scope(path)?;
    if !path_within_scopes(path, &policy.allow_write_scopes) {
        return Err(format!(
            "Plugin write directory is outside approved scopes: {}",
            path.display()
        ));
    }
    Ok(())
}

fn path_within_scopes(path: &Path, scopes: &[PathBuf]) -> bool {
    let normalized = normalize_existing_or_parent(path);
    scopes
        .iter()
        .map(|scope| normalize_existing_or_parent(scope))
        .any(|scope| normalized == scope || normalized.starts_with(&format!("{scope}/")))
}

fn normalize_existing_or_parent(path: &Path) -> String {
    let resolved = if path.exists() {
        std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
    } else if let Some(parent) = path.parent() {
        std::fs::canonicalize(parent)
            .map(|parent| parent.join(path.file_name().unwrap_or_default()))
            .unwrap_or_else(|_| path.to_path_buf())
    } else {
        path.to_path_buf()
    };
    resolved
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string()
}

fn is_local_path_candidate(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.starts_with('-') || trimmed.contains("://") {
        return false;
    }
    let path = Path::new(trimmed.strip_prefix("file:").unwrap_or(trimmed));
    path.is_absolute()
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || path.extension().is_some()
}

fn plugin_temp_dir_path(prefix: &str) -> PathBuf {
    let mut base = std::env::temp_dir();
    base.push(format!("{}{}", prefix, uuid::Uuid::new_v4()));
    base
}

fn has_valid_auth(headers: &str, token: &str) -> bool {
    headers.lines().any(|line| {
        line.split_once(':')
            .map(|(key, value)| {
                key.eq_ignore_ascii_case("authorization")
                    && value.trim() == format!("Bearer {token}")
            })
            .unwrap_or(false)
    })
}

fn find_headers_end(buffer: &[u8]) -> Option<usize> {
    buffer.windows(4).position(|window| window == b"\r\n\r\n")
}

fn parse_content_length(headers: &[u8]) -> Result<usize, String> {
    let text = String::from_utf8_lossy(headers);
    for line in text.lines() {
        if let Some((key, value)) = line.split_once(':') {
            if key.eq_ignore_ascii_case("content-length") {
                let parsed = value
                    .trim()
                    .parse::<usize>()
                    .map_err(|_| "Invalid Content-Length.".to_string())?;
                if parsed > MAX_BRIDGE_BODY_BYTES {
                    return Err("Plugin bridge request is too large.".to_string());
                }
                return Ok(parsed);
            }
        }
    }
    Ok(0)
}

async fn write_json_response<T: Serialize>(
    stream: &mut TcpStream,
    status: u16,
    result: Option<T>,
    error: Option<&str>,
) -> Result<(), String> {
    let response = BridgeResponse {
        ok: error.is_none() && status < 400,
        result,
        error: error.map(str::to_string),
    };
    let body = serde_json::to_vec(&response)
        .map_err(|e| format!("Failed to serialize plugin bridge response: {e}"))?;
    let reason = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        413 => "Payload Too Large",
        _ => "Internal Server Error",
    };
    let header = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream
        .write_all(header.as_bytes())
        .await
        .map_err(|e| format!("Failed to write plugin bridge response: {e}"))?;
    stream
        .write_all(&body)
        .await
        .map_err(|e| format!("Failed to write plugin bridge response: {e}"))?;
    Ok(())
}
