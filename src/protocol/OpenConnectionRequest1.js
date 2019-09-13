"use strict"

const OfflineMessage = require("./OfflineMessage.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class OpenConnectionRequest1 extends OfflineMessage {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_OPEN_CONNECTION_REQUEST_1;
        
    this.protocol = 9;
    
    this.mtuSize;
  }
  
  encodePayload() {
    this.writeMagic();
    this.writeByte(this.protocol);
    //this.buffer = str_pad THINGY.
  }
  
  decodePayload() {
    this.readMagic();
    this.protocol = this.readByte();
    this.mtuSize = this.length;
    this.getRemainingBytes();
  }
}

module.exports = OpenConnectionRequest1;