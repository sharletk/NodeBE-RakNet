"use strict"

const UnconnectedPing = require("./UnconnectedPing.js");

const MessageIdentifiers = require("./MessageIdentifiers.js");

class UnconnectedPingOpenConnections extends UnconnectedPing {
  constructor() {
    super();
    
    this.ID = MessageIdentifiers.ID_UNCONNECTED_PING_OPEN_CONNECTIONS;
  }
}

module.exports = UnconnectedPingOpenConnections;