import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MCPClientManager, MCPServerConfig } from '../mcp-client'

describe('MCPClientManager', () => {
  let manager: MCPClientManager

  beforeEach(() => {
    manager = new MCPClientManager()
  })

  afterEach(async () => {
    await manager.disconnectAll()
  })

  it('should create an empty manager', () => {
    const status = manager.getStatus()
    expect(status).toEqual({})
  })

  it('should return empty tools when no servers are connected', () => {
    const tools = manager.getAllTools()
    expect(tools).toEqual([])
  })

  it('should detect that a tool does not belong to an external server', () => {
    const result = manager.isExternalTool('some-random-tool')
    expect(result).toBe(false)
  })

  it('should handle invalid tool name format in callTool', async () => {
    await expect(manager.callTool('invalid-name', {})).rejects.toThrow(
      'Invalid tool name format'
    )
  })

  it('should throw error when calling tool on non-existent server', async () => {
    await expect(manager.callTool('nonexistent__tool', {})).rejects.toThrow(
      'MCP server nonexistent not found'
    )
  })

  // Note: We can't easily test actual MCP server connections in unit tests
  // as they require spawning real processes. Integration tests would be better
  // for testing full connection flows.
})

describe('MCPServerConfig validation', () => {
  it('should have required fields', () => {
    const config: MCPServerConfig = {
      name: 'test-server',
      command: 'node',
      args: ['server.js']
    }

    expect(config.name).toBe('test-server')
    expect(config.command).toBe('node')
    expect(config.args).toEqual(['server.js'])
  })

  it('should support optional env field', () => {
    const config: MCPServerConfig = {
      name: 'test-server',
      command: 'node',
      env: { API_KEY: 'test-key' }
    }

    expect(config.env).toEqual({ API_KEY: 'test-key' })
  })
})
