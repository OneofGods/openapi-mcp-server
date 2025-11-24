import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Tool } from '@modelcontextprotocol/sdk/types.js'

export interface MCPServerConfig {
  /**
   * Unique name for this MCP server connection
   */
  name: string
  /**
   * Command to run to start the MCP server
   */
  command: string
  /**
   * Arguments to pass to the command
   */
  args?: string[]
  /**
   * Environment variables for the server process
   */
  env?: Record<string, string>
}

/**
 * Manages a connection to an external MCP server
 */
export class MCPClientConnection {
  private client: Client
  private transport: StdioClientTransport
  private tools: Tool[] = []
  private connected: boolean = false

  constructor(public config: MCPServerConfig) {
    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: config.env
    })

    this.client = new Client(
      {
        name: `openapi-mcp-client-${config.name}`,
        version: '1.0.0'
      },
      {
        capabilities: {}
      }
    )
  }

  /**
   * Connect to the external MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      console.warn(`MCP client ${this.config.name} is already connected`)
      return
    }

    try {
      console.error(`Connecting to MCP server: ${this.config.name}...`)
      await this.client.connect(this.transport)
      this.connected = true

      // Fetch available tools
      await this.refreshTools()
      console.error(`Successfully connected to ${this.config.name} with ${this.tools.length} tools`)
    } catch (error) {
      console.error(`Failed to connect to MCP server ${this.config.name}:`, error)
      throw error
    }
  }

  /**
   * Refresh the list of available tools from the server
   */
  async refreshTools(): Promise<void> {
    try {
      const response = await this.client.listTools()
      this.tools = response.tools
      console.error(`Refreshed ${this.tools.length} tools from ${this.config.name}`)
    } catch (error) {
      console.error(`Failed to refresh tools from ${this.config.name}:`, error)
      throw error
    }
  }

  /**
   * Get all available tools from this server
   */
  getTools(): Tool[] {
    return this.tools.map(tool => ({
      ...tool,
      // Prefix tool names with server name to avoid conflicts
      name: `${this.config.name}__${tool.name}`
    }))
  }

  /**
   * Call a tool on this MCP server
   */
  async callTool(toolName: string, args: any): Promise<any> {
    if (!this.connected) {
      throw new Error(`MCP client ${this.config.name} is not connected`)
    }

    // Remove the server prefix if present
    const actualToolName = toolName.startsWith(`${this.config.name}__`)
      ? toolName.slice(`${this.config.name}__`.length)
      : toolName

    try {
      console.error(`Calling tool ${actualToolName} on ${this.config.name}`)
      const response = await this.client.callTool({
        name: actualToolName,
        arguments: args
      })
      return response
    } catch (error) {
      console.error(`Failed to call tool ${actualToolName} on ${this.config.name}:`, error)
      throw error
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return
    }

    try {
      await this.transport.close()
      this.connected = false
      console.error(`Disconnected from ${this.config.name}`)
    } catch (error) {
      console.error(`Error disconnecting from ${this.config.name}:`, error)
    }
  }

  /**
   * Check if the client is connected
   */
  isConnected(): boolean {
    return this.connected
  }
}

/**
 * Manages multiple MCP client connections
 */
export class MCPClientManager {
  private clients: Map<string, MCPClientConnection> = new Map()

  /**
   * Add a new MCP server connection
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (this.clients.has(config.name)) {
      console.warn(`MCP server ${config.name} is already registered`)
      return
    }

    const client = new MCPClientConnection(config)
    this.clients.set(config.name, client)
    await client.connect()
  }

  /**
   * Add multiple MCP server connections
   */
  async addServers(configs: MCPServerConfig[]): Promise<void> {
    await Promise.all(configs.map(config => this.addServer(config)))
  }

  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): Tool[] {
    const allTools: Tool[] = []

    for (const client of this.clients.values()) {
      if (client.isConnected()) {
        allTools.push(...client.getTools())
      }
    }

    return allTools
  }

  /**
   * Call a tool on the appropriate MCP server
   */
  async callTool(toolName: string, args: any): Promise<any> {
    // Extract server name from tool name (format: servername__toolname)
    const parts = toolName.split('__')
    if (parts.length < 2) {
      throw new Error(`Invalid tool name format: ${toolName}. Expected format: servername__toolname`)
    }

    const serverName = parts[0]
    const client = this.clients.get(serverName)

    if (!client) {
      throw new Error(`MCP server ${serverName} not found`)
    }

    if (!client.isConnected()) {
      throw new Error(`MCP server ${serverName} is not connected`)
    }

    return await client.callTool(toolName, args)
  }

  /**
   * Check if a tool belongs to an external MCP server
   */
  isExternalTool(toolName: string): boolean {
    const serverName = toolName.split('__')[0]
    return this.clients.has(serverName)
  }

  /**
   * Disconnect all MCP clients
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      Array.from(this.clients.values()).map(client => client.disconnect())
    )
    this.clients.clear()
  }

  /**
   * Get connection status for all servers
   */
  getStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {}
    for (const [name, client] of this.clients.entries()) {
      status[name] = client.isConnected()
    }
    return status
  }
}
