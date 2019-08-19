"use strict";

const RakNetServer = require("./server/RakNetServer.js");

class NodeBERakNet {
  constructor() {
    this.VERSION = "0.1.0";
    
    this.MIN_NODEJS_VERSION = 8;
    
    this.DEFAULT_PROTOCOL_VERSION = 6;
    
    this.PRIORITY_NORMAL = 0;
    this.PRIORITY_IMMEDIATE = 1;
    
    this.FLAG_NEED_ACK = 0b00001000;
    
    this.SYSTEM_ADDRESS_COUNT = 20;
        
    this.error = 0;
    
    this.ready = false;
    
    this.server;
  }
  
  versionCheck(...args) {     
    if (Number(process.version.slice(1).split(".")[0]) < this.MIN_NODEJS_VERSION) {
      new logger().error("NodeBE-RakNet requires a node of 8.0.0 or higher, please update it on your system.");
      ++this.error;
    }
  }
  
  dependanciesCheck(...args) {}
  
  init(...args) {
    this.versionCheck(...args);
    this.dependanciesCheck(...args);
    
    if (this.error > 0) {
      process.exit(1);
      this.error = 0;
    } else {
      this.server = new RakNetServer(...args);
    }
  }
  
  async run(...args) {
    await this.init(...args);
    
    this.server.run();
    this.ready = true;
  }
}

module.exports = NodeBERakNet;