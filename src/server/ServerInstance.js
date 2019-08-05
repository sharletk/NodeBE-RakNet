"use strict"

class ServerInstance {
  constructor() {}
  
  openSession(serverId, address, port, clientID) {
    return;
  }
  
  closeSession(sessionId, reason) {
    return;
  }
  
  handleEncapsulated(sessionId, packet, flags) {
    return;
  }
  
  handleRaw(address, port, payload) {
    return;
  }
  
  notifyACK(sessionId, identifierACK) {
    return;
  }
  
  handleOption(option, value) {
    return;
  }
  
  updatePing(sessionId, pingMS) {
    return;
  }
}

module.exports = ServerInstance;