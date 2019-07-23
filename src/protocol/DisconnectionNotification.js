"use strict"

const Packet = require("./Packet.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class DisconnectionNotification extends Packet {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_DISCONNECTION_NOTIFICATION;
  }
  
  encodePayload() {}
  
  decodePayload() {}
}

module.exports = DisconnectionNotification;