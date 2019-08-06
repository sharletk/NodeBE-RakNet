"use strict"

const Socket = require("./Socket.js");
const SessionManager = require("./SessionManager.js");

class RakNetServer {
  constructor(logger, address, maxMtuSize, overrideProtocolVersion, sleeper) {
    this.address = address;
    
    this.logger = logger;
    
    this.shutdown = false;    
    this.ready = false;
    
    this.externalQueue = [];
    this.internalQueue = [];
    
    this.mainPath;
    
    this.serverId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;   
    this.maxMtuSize = maxMtuSize || 1429;    
    this.protocolVersion = overrideProtocolVersion ? 9 : null;
    
    this.mainThreadNotifier = sleeper;
    
    this.socket;
    this.sessionManager;
  }
  
  isShutdown() {
    return this.shutdown === true;
  }
  
  shutdown() {
    this.shutdown = true;
  }
  
  getServerId() {
    return this.serverId;
  }
  
  getProtocolVersion() {
    return this.protocolVersion;
  }
  
  getLogger() {
    return this.logger;
  }
  
  getExternalQueue() {
    return this.externalQueue;
  }
  
  getInternalQueue() {
    return this.internalQueue;
  }
  
  pushMainToThreadPacket(str) {
    this.internalQueue.push(str);
  }
  
  readMainToThreadPacket() {
    return this.internalQueue.shift();
  }
  
  pushThreadToMainPacket(str) {
    this.externalQueue.push(str);
    /*if(this.mainThreadNotifier !== null) {
      this.mainThreadNotifier.wakeupSleeper();
    }*/
  }
  
  readThreadToMainPacket() {
    return this.externalQueue.shift();
  }
  
  shutdownHandler() {
    this.logger.error("RakNet crashed unexpectadly.");
    // Needs to be implemented properly.
  }
  
  // Add a way to get crash stack trace and info.
  
  init() {
    try {      
      this.socket = new Socket(this.address);
      this.sessionManager = new SessionManager(this, this.socket, this.maxMtuSize);
      
      this.manager.run();
    } catch(err) {
      console.error(err);
    }
  }
  
  async run() {
    await this.init();
    this.ready = true;
  }
}

module.exports = RakNetServer;