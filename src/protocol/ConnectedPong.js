"use strict"

const Packet = require("./Packet.js") ;

const MessageIdentifiers = require("./MessageIdentifiers.js")

class ConnectedPong extends Packet {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_CONNECTED_PONG;
    
    this.sendPingTime;
    this.sendPongTime;
  }
  
  encodePayload() {
    this.writeLong(sendPingTime);
    this.writeLong(sendPongTime);
  }
  
  decodePayload() {
    this.sendPingTime = this.readLong();
    this.sendPongTime = this.readLong();
  }
}

module.exports = ConnectedPong;