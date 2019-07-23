"use strict"

const AcknowledgePacket = require("./AcknowledgePacket.js");

class ACK extends AcknowledgePacket {
  constructor() {
    super();
    
    this.ID = 0xc0;
  }
}

module.exports = ACK;