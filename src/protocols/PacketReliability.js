"use strict"

const Packet = require("./Packet.js");

class PacketReliability extends Packet {
  constructor() {
    super();
    
    this.UNRELIABLE = 0;
    this.UNRELIABLE_SEQUENCED = 1;
	  this.RELIABLE = 2;
	  this.RELIABLE_ORDERED = 3;
	  this.RELIABLE_SEQUENCED = 4;
	  this.UNRELIABLE_WITH_ACK_RECEIPT = 5;
	  this.RELIABLE_WITH_ACK_RECEIPT = 6;
	  this.RELIABLE_ORDERED_WITH_ACK_RECEIPT = 7;
  }
  
  isReliable(reliability) {
    return (
      reliability === this.RELIABLE || reliability === this.RELIABLE_ORDERED || reliability === this.RELIABLE_SEQUENCED || reliability === this.RELIABLE_WITH_ACK_RECEIPT || reliability === this.RELIABLE_ORDERED_WITH_ACK_RECEIPT
    );
  }
  
  isSequenced(reliability) {
    return (
      reliability === this.UNRELIABLE_SEQUENCED || reliability === this.RELIABLE_SEQUENCED
    );
  }
  
  isOrdered(reliability) {
    return (
      reliability === this.RELIABLE_ORDERED || reliability === this.RELIABLE_WITH_ACK_RECEIPT
    );
  }
  
  isSequencedOrOrdered(reliability) {
    return (
      reliability === this.UNRELIABLE_SEQUENCED || reliability === this.RELIABLE_SEQUENCED || reliability === this.RELIABLE_ORDERED || reliability === this.RELIABLE_ORDERED_WITH_ACK_RECEIPT
    );
  }
}

module.exports = PacketReliability;