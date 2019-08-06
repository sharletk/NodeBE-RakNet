"use strict"

const dgram = require("dgram");

class Socket {
  constructor(bindAddress) {
    this.bindAddress = bindAddress;
    
    this.socket = dgram.createSocket(this.bindAddress.version === 4 ? "udp4" : "udp6");
    
    this.socket.bind({
      ip: this.bindAddress.ip,
      port: this.bindAddress.port,
      exclusive: this.bindAddress.exclusive === true ? true : false
    });
    
    this.socket.ready = false;
    
    this.socket.on("listening", () => {
      this.socket.ready = true;
      this.run();
    });
  }
  
  registerListener(obj) {
    this.listenerMap.push(obj);
  }
  
  getBindAddress() {
    return this.bindAddress;
  }
  
  getSocket() {
    return this.socket;
  }
  
  close() {
    this.socket.close();
  }
  
  //readPacket() {} Staged for future implementation.
  
  writePacket(buffer, address, port) {
    return this.socket.send(buffer, 0, buffer.length, port, address);
  }
  
  getSendBuffer() {
    return this.socket.getSendBufferSize();
  }
  
  getRecvBuffer() {
    return this.socket.getRecvBufferSize();
  }
  
  setSendBuffer(size) {
    return this.socket.setSendBufferSize(size);
  }
  
  setRecvBuffer(size) {
    return this.socket.setRecvBufferSize(size);
  }
  
  run() {
    if (this.socket.ready === true) {
      this.setSendBuffer(1024 * 1024 * 8);
      this.setRecvBuffer(1024 * 1024 * 8);
    } else {
      throw new Error(`Unable to bind on socket ${this.bindAddress.ip}:${this.bindAddress.port} [v${this.bindAddress.version}], make sure the given dataset is correct`);
    }
  }
}

module.exports = Socket;