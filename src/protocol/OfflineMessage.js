"use strict"

const Packet = require("./Packet.js");

class OfflineMessage extends Packet {
  constructor() {
    super();
    
    this.MAGIC = "\x00\xff\xff\x00\xfe\xfe\xfe\xfe\xfd\xfd\xfd\xfd\x12\x34\x56\x78";
    
    this.magic;
  }
  
  readMagic() {
    this.magic = this.readData(16);
  }
  
  writeMagic() {
    this.writeData(this.MAGIC);
  }
  
  isValid() {
  }
}

module.exports = OfflineMessage;