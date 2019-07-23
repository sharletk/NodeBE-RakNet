"use strict"

const AcknowledgePacket = require("./AcknowledgePacket.js");

class NACK extends AcknowledgePacket {
  constructor() {
    super();
    
    this.ID = 0xa0;
  }
}

module.exports = NACK;