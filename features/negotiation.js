// Automated Price Negotiation Module
// AI-powered negotiation strategies for AgentMarket

export class NegotiationEngine {
  constructor(config = {}) {
    this.strategy = config.strategy || 'balanced'
    this.minAcceptableDiscount = config.minDiscount || 0.1
    this.maxAcceptableDiscount = config.maxDiscount || 0.3
    this.negotiationRounds = config.maxRounds || 3
  }

  /**
   * Generate initial offer based on listing price
   * @param {number} listPrice - Listed service price
   * @param {Object} context - Market context
   * @returns {number} Initial offer amount
   */
  generateInitialOffer(listPrice, context = {}) {
    const { buyerBudget, marketAverage, urgency } = context
    
    // Strategy: Aggressive
    if (this.strategy === 'aggressive') {
      return listPrice * (1 - this.maxAcceptableDiscount)
    }
    
    // Strategy: Conservative
    if (this.strategy === 'conservative') {
      return listPrice * (1 - this.minAcceptableDiscount)
    }
    
    // Strategy: Balanced (default)
    const discountFactor = (this.minAcceptableDiscount + this.maxAcceptableDiscount) / 2
    let offer = listPrice * (1 - discountFactor)
    
    // Adjust for urgency
    if (urgency === 'high') {
      offer = offer * 1.1 // Willing to pay more
    }
    
    // Adjust for budget constraints
    if (buyerBudget && offer > buyerBudget) {
      offer = buyerBudget * 0.95 // Leave some margin
    }
    
    return Math.round(offer * 100) / 100
  }

  /**
   * Generate counter-offer
   * @param {number} currentOffer - Current offer amount
   * @param {number} listPrice - Original listing price
   * @param {number} round - Current negotiation round
   * @returns {number} Counter-offer amount
   */
  generateCounterOffer(currentOffer, listPrice, round) {
    const progress = round / this.negotiationRounds
    
    // Gradually move toward list price
    const gap = listPrice - currentOffer
    const movePercentage = 0.3 + (progress * 0.4) // Move 30-70% of gap
    
    const counterOffer = currentOffer + (gap * movePercentage)
    
    return Math.round(counterOffer * 100) / 100
  }

  /**
   * Decide whether to accept an offer
   * @param {number} offer - Offered amount
   * @param {number} listPrice - Your listing price
   * @param {Object} context - Decision context
   * @returns {boolean} Accept decision
   */
  shouldAcceptOffer(offer, listPrice, context = {}) {
    const { sellerReputation, demandLevel, alternativeOffers } = context
    
    const discountPercentage = (listPrice - offer) / listPrice
    
    // Always accept if within minimum discount
    if (discountPercentage <= this.minAcceptableDiscount) {
      return true
    }
    
    // Reject if beyond maximum discount
    if (discountPercentage > this.maxAcceptableDiscount) {
      return false
    }
    
    // Consider reputation
    if (sellerReputation && sellerReputation.rating > 4.5) {
      // High reputation sellers can be more selective
      return discountPercentage <= (this.minAcceptableDiscount + 0.05)
    }
    
    // Consider demand
    if (demandLevel === 'low' && alternativeOffers < 2) {
      // Accept lower offers if demand is low
      return discountPercentage <= (this.maxAcceptableDiscount + 0.05)
    }
    
    // Default: Accept if within acceptable range
    return discountPercentage <= this.maxAcceptableDiscount
  }

  /**
   * Calculate optimal price based on market data
   * @param {Object} marketData - Market statistics
   * @returns {number} Optimal price
   */
  calculateOptimalPrice(marketData) {
    const { averagePrice, highestPrice, lowestPrice, totalListings } = marketData
    
    if (!averagePrice) {
      return null // Not enough data
    }
    
    // Competitive pricing strategy
    let optimalPrice = averagePrice
    
    // If few competitors, price higher
    if (totalListings < 3) {
      optimalPrice = averagePrice * 1.1
    }
    
    // If many competitors, price slightly below average
    if (totalListings > 10) {
      optimalPrice = averagePrice * 0.95
    }
    
    // Ensure within reasonable bounds
    optimalPrice = Math.max(optimalPrice, lowestPrice * 1.05)
    optimalPrice = Math.min(optimalPrice, highestPrice * 0.95)
    
    return Math.round(optimalPrice * 100) / 100
  }

  /**
   * Simulate negotiation rounds
   * @param {number} buyerBudget - Buyer's maximum budget
   * @param {number} sellerPrice - Seller's asking price
   * @returns {Object} Negotiation result
   */
  simulateNegotiation(buyerBudget, sellerPrice) {
    const rounds = []
    let currentOffer = this.generateInitialOffer(sellerPrice, { buyerBudget })
    
    for (let i = 1; i <= this.negotiationRounds; i++) {
      const round = {
        number: i,
        buyerOffer: currentOffer,
        sellerCounterOffer: null,
        accepted: false
      }
      
      // Check if seller accepts
      if (this.shouldAcceptOffer(currentOffer, sellerPrice)) {
        round.accepted = true
        round.finalPrice = currentOffer
        rounds.push(round)
        break
      }
      
      // Seller counters
      round.sellerCounterOffer = this.generateCounterOffer(currentOffer, sellerPrice, i)
      
      // Check if buyer accepts counter
      if (round.sellerCounterOffer <= buyerBudget * 1.05) {
        round.accepted = true
        round.finalPrice = round.sellerCounterOffer
        rounds.push(round)
        break
      }
      
      // Prepare for next round
      currentOffer = round.sellerCounterOffer * 0.9 // Buyer adjusts
      rounds.push(round)
    }
    
    const finalRound = rounds[rounds.length - 1]
    
    return {
      successful: finalRound.accepted,
      rounds: rounds,
      finalPrice: finalRound.finalPrice || null,
      savings: finalRound.accepted ? (sellerPrice - finalRound.finalPrice) : 0
    }
  }

  /**
   * Get negotiation tips for agents
   * @param {string} role - 'buyer' or 'seller'
   * @returns {Array} Tips and strategies
   */
  getNegotiationTips(role) {
    const tips = {
      buyer: [
        'Research average market prices before making offers',
        'Start with a reasonable discount (10-20% below list)',
        'Consider seller reputation when negotiating',
        'Be willing to walk away if price is too high',
        'Bundle multiple services for better discounts'
      ],
      seller: [
        'Price competitively based on market data',
        'High reputation allows for premium pricing',
        'Be flexible with new buyers to build relationships',
        'Consider volume discounts for repeat customers',
        'Set minimum acceptable prices before negotiating'
      ]
    }
    
    return tips[role] || []
  }
}

// Negotiation strategies
export const NegotiationStrategies = {
  AGGRESSIVE: 'aggressive',    // Maximum discount seeking
  BALANCED: 'balanced',         // Moderate approach
  CONSERVATIVE: 'conservative', // Minimal haggling
  ADAPTIVE: 'adaptive'          // Adjust based on context
}

// Market conditions
export const MarketConditions = {
  HIGH_DEMAND: 'high_demand',
  BALANCED: 'balanced',
  LOW_DEMAND: 'low_demand'
}

export default NegotiationEngine
