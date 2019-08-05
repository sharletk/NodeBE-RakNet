"use strict"

const dgram = require("dgram");

class Socket {
  constructor(bindAddress) {
    this.bindAddress = bindAddress;
    
    this.socket = dgram.createSocket(this.bindAddress.version === 4 ? "udp4" : "udp6");
    
    if(this.socket.bind({
      ip: this.bindAddress.ip,
      port: this.bindAddress.port,
      exclusive: this.bindAddress.exclusive === true ? true : false
    }) === true) {
      this.setSendBuffer(1024 * 1024 * 8).setRecvBuffer(1024 * 1024 * 8);
    } else {
      throw new Error(`Error: Unable to bind on socket ${bindAddress.ip}:${bindAddress.port}[v${bindAddress.version}], make sure the given dataset is correct`);
    }
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
}

module.exports = Socket;