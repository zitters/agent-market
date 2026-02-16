#!/usr/bin/env node
import Hyperswarm from 'hyperswarm'
import crypto from 'hypercore-crypto'
import b4a from 'b4a'
import chalk from 'chalk'
import readline from 'readline'

// AgentMarket - Decentralized AI Agent Service Marketplace
// Built on Trac Network Intercom Protocol

const MARKET_TOPIC = crypto.hash(b4a.from('agent-market-v1-main'))
const VERSION = '1.0.0'

class AgentMarket {
  constructor(agentName, agentType = 'buyer') {
    this.agentName = agentName
    this.agentType = agentType // 'buyer', 'seller', or 'both'
    this.swarm = new Hyperswarm()
    this.peers = new Map()
    this.services = new Map()
    this.orders = new Map()
    this.myServices = []
    this.negotiations = new Map()
    this.reputation = { successful: 0, failed: 0, rating: 5.0 }
    
    this.setupSwarm()
    this.setupCLI()
  }

  setupSwarm() {
    const discovery = this.swarm.join(MARKET_TOPIC, { client: true, server: true })
    discovery.flushed().then(() => {
      console.log(chalk.green(`✓ ${this.agentName} joined AgentMarket`))
      console.log(chalk.gray(`  Topic: ${b4a.toString(MARKET_TOPIC, 'hex')}`))
      this.broadcastPresence()
    })

    this.swarm.on('connection', (conn, info) => {
      const peerId = b4a.toString(info.publicKey, 'hex').slice(0, 8)
      console.log(chalk.blue(`→ New peer connected: ${peerId}`))
      
      this.peers.set(peerId, { conn, info, lastSeen: Date.now() })
      
      conn.on('data', (data) => this.handleMessage(data, peerId))
      conn.on('error', (err) => console.error(chalk.red(`Peer ${peerId} error:`), err))
      conn.on('close', () => {
        console.log(chalk.yellow(`← Peer disconnected: ${peerId}`))
        this.peers.delete(peerId)
      })
    })
  }

  setupCLI() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan(`${this.agentName}> `)
    })

    console.log(chalk.bold.magenta('\n╔════════════════════════════════════════╗'))
    console.log(chalk.bold.magenta('║     AgentMarket v' + VERSION + '             ║'))
    console.log(chalk.bold.magenta('║  Decentralized AI Agent Marketplace   ║'))
    console.log(chalk.bold.magenta('╚════════════════════════════════════════╝\n'))
    
    this.showHelp()
    rl.prompt()

    rl.on('line', (line) => {
      this.handleCommand(line.trim())
      rl.prompt()
    })
  }

  showHelp() {
    console.log(chalk.white.bold('Commands:'))
    console.log(chalk.gray('  /offer <service> <price>    - List a service you provide'))
    console.log(chalk.gray('  /search <keyword>           - Search for services'))
    console.log(chalk.gray('  /buy <serviceId>            - Purchase a service'))
    console.log(chalk.gray('  /myservices                 - Show your listed services'))
    console.log(chalk.gray('  /orders                     - Show your order history'))
    console.log(chalk.gray('  /reputation                 - View your reputation score'))
    console.log(chalk.gray('  /peers                      - List connected peers'))
    console.log(chalk.gray('  /help                       - Show this help'))
    console.log(chalk.gray('  /quit                       - Exit marketplace\n'))
  }

  async handleCommand(cmd) {
    const parts = cmd.split(' ')
    const command = parts[0].toLowerCase()

    switch (command) {
      case '/offer':
        if (parts.length < 3) {
          console.log(chalk.red('Usage: /offer <service-name> <price-in-tnk>'))
          return
        }
        const service = parts.slice(1, -1).join(' ')
        const price = parseFloat(parts[parts.length - 1])
        this.offerService(service, price)
        break

      case '/search':
        const keyword = parts.slice(1).join(' ')
        this.searchServices(keyword)
        break

      case '/buy':
        if (parts.length < 2) {
          console.log(chalk.red('Usage: /buy <service-id>'))
          return
        }
        this.initiateOrder(parts[1])
        break

      case '/myservices':
        this.showMyServices()
        break

      case '/orders':
        this.showOrders()
        break

      case '/reputation':
        this.showReputation()
        break

      case '/peers':
        this.showPeers()
        break

      case '/help':
        this.showHelp()
        break

      case '/quit':
        console.log(chalk.yellow('Exiting AgentMarket...'))
        await this.swarm.destroy()
        process.exit(0)
        break

      default:
        if (cmd.startsWith('/')) {
          console.log(chalk.red('Unknown command. Type /help for available commands.'))
        }
    }
  }

  broadcastPresence() {
    const message = {
      type: 'PRESENCE',
      agent: this.agentName,
      agentType: this.agentType,
      reputation: this.reputation,
      timestamp: Date.now(),
      services: this.myServices
    }
    this.broadcast(message)
  }

  offerService(serviceName, price) {
    const serviceId = crypto.randomBytes(4).toString('hex')
    const service = {
      id: serviceId,
      name: serviceName,
      price: price,
      provider: this.agentName,
      timestamp: Date.now(),
      status: 'available'
    }
    
    this.myServices.push(service)
    console.log(chalk.green(`✓ Service listed: "${serviceName}" for ${price} TNK (ID: ${serviceId})`))
    
    const message = {
      type: 'SERVICE_OFFER',
      service: service
    }
    this.broadcast(message)
  }

  searchServices(keyword) {
    console.log(chalk.cyan(`\n🔍 Searching for: "${keyword}"\n`))
    
    const results = []
    this.services.forEach((service, id) => {
      if (keyword === '' || service.name.toLowerCase().includes(keyword.toLowerCase())) {
        results.push(service)
      }
    })

    if (results.length === 0) {
      console.log(chalk.yellow('No services found matching your search.'))
      console.log(chalk.gray('Try /search with a different keyword or leave blank to see all.\n'))
      return
    }

    console.log(chalk.white.bold(`Found ${results.length} service(s):\n`))
    results.forEach((service, idx) => {
      console.log(chalk.white(`${idx + 1}. ${chalk.bold(service.name)}`))
      console.log(chalk.gray(`   Provider: ${service.provider} | Price: ${service.price} TNK`))
      console.log(chalk.gray(`   Service ID: ${service.id}`))
      console.log(chalk.gray(`   Status: ${service.status}\n`))
    })
  }

  initiateOrder(serviceId) {
    const service = this.services.get(serviceId)
    
    if (!service) {
      console.log(chalk.red(`Service ${serviceId} not found. Use /search to find services.`))
      return
    }

    if (service.status !== 'available') {
      console.log(chalk.red(`Service is currently ${service.status}`))
      return
    }

    const orderId = crypto.randomBytes(4).toString('hex')
    const order = {
      id: orderId,
      serviceId: serviceId,
      serviceName: service.name,
      buyer: this.agentName,
      seller: service.provider,
      price: service.price,
      status: 'pending',
      timestamp: Date.now()
    }

    this.orders.set(orderId, order)
    console.log(chalk.green(`✓ Order initiated: ${orderId}`))
    console.log(chalk.gray(`  Negotiating with ${service.provider}...\n`))

    // Broadcast order request
    const message = {
      type: 'ORDER_REQUEST',
      order: order
    }
    this.broadcast(message)

    // Simulate negotiation
    setTimeout(() => {
      order.status = 'negotiating'
      console.log(chalk.blue(`⚡ Negotiation in progress for order ${orderId}`))
    }, 2000)

    setTimeout(() => {
      order.status = 'confirmed'
      console.log(chalk.green(`✓ Order ${orderId} confirmed! Settlement pending...`))
      
      // Update reputation
      this.reputation.successful++
      this.updateReputation()
    }, 5000)
  }

  showMyServices() {
    console.log(chalk.cyan('\n📋 Your Listed Services:\n'))
    
    if (this.myServices.length === 0) {
      console.log(chalk.yellow('You have no services listed.'))
      console.log(chalk.gray('Use /offer <service-name> <price> to list a service.\n'))
      return
    }

    this.myServices.forEach((service, idx) => {
      console.log(chalk.white(`${idx + 1}. ${chalk.bold(service.name)}`))
      console.log(chalk.gray(`   Price: ${service.price} TNK | Status: ${service.status}`))
      console.log(chalk.gray(`   ID: ${service.id}\n`))
    })
  }

  showOrders() {
    console.log(chalk.cyan('\n📦 Your Orders:\n'))
    
    if (this.orders.size === 0) {
      console.log(chalk.yellow('No orders yet.\n'))
      return
    }

    this.orders.forEach((order) => {
      const statusColor = order.status === 'confirmed' ? 'green' : 
                         order.status === 'negotiating' ? 'blue' : 'yellow'
      
      console.log(chalk.white(`Order ${chalk.bold(order.id)}`))
      console.log(chalk.gray(`  Service: ${order.serviceName}`))
      console.log(chalk.gray(`  Seller: ${order.seller} | Price: ${order.price} TNK`))
      console.log(chalk[statusColor](`  Status: ${order.status}\n`))
    })
  }

  showReputation() {
    const total = this.reputation.successful + this.reputation.failed
    const successRate = total > 0 ? (this.reputation.successful / total * 100).toFixed(1) : 0
    
    console.log(chalk.cyan('\n⭐ Your Reputation:\n'))
    console.log(chalk.white(`  Rating: ${chalk.bold(this.reputation.rating.toFixed(1))}/5.0`))
    console.log(chalk.green(`  Successful: ${this.reputation.successful}`))
    console.log(chalk.red(`  Failed: ${this.reputation.failed}`))
    console.log(chalk.gray(`  Success Rate: ${successRate}%\n`))
  }

  showPeers() {
    console.log(chalk.cyan(`\n🌐 Connected Peers: ${this.peers.size}\n`))
    
    if (this.peers.size === 0) {
      console.log(chalk.yellow('No peers connected yet.\n'))
      return
    }

    this.peers.forEach((peer, id) => {
      console.log(chalk.white(`  ${id} - Connected ${Math.floor((Date.now() - peer.lastSeen) / 1000)}s ago`))
    })
    console.log()
  }

  updateReputation() {
    const total = this.reputation.successful + this.reputation.failed
    if (total > 0) {
      this.reputation.rating = (this.reputation.successful / total) * 5.0
    }
  }

  handleMessage(data, peerId) {
    try {
      const message = JSON.parse(data.toString())
      
      switch (message.type) {
        case 'PRESENCE':
          console.log(chalk.gray(`[${peerId}] ${message.agent} is online (${message.agentType})`))
          if (message.services && message.services.length > 0) {
            message.services.forEach(service => {
              this.services.set(service.id, service)
            })
          }
          break

        case 'SERVICE_OFFER':
          this.services.set(message.service.id, message.service)
          console.log(chalk.blue(`📢 New service: "${message.service.name}" by ${message.service.provider} (${message.service.price} TNK)`))
          break

        case 'ORDER_REQUEST':
          if (message.order.seller === this.agentName) {
            console.log(chalk.green(`💰 Order request received from ${message.order.buyer}`))
            console.log(chalk.gray(`   Service: ${message.order.serviceName} | ${message.order.price} TNK`))
          }
          break
      }
    } catch (err) {
      console.error(chalk.red('Error parsing message:'), err)
    }
  }

  broadcast(message) {
    const data = JSON.stringify(message)
    this.peers.forEach((peer) => {
      try {
        peer.conn.write(data)
      } catch (err) {
        console.error(chalk.red('Broadcast error:'), err)
      }
    })
  }
}

// Start the agent
const agentName = process.argv[2] || 'Agent-' + crypto.randomBytes(3).toString('hex')
const agentType = process.argv[3] || 'both'

const market = new AgentMarket(agentName, agentType)

process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\nShutting down gracefully...'))
  await market.swarm.destroy()
  process.exit(0)
})
