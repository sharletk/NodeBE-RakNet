"use strict"

const Packet = require("./Packet.js");

const BinaryStream = require("nodebe-binarystream");

class AcknowledgePacket extends Packet {
  constructor() {
    super();
    
    this.RECORD_TYPE_RANGE = 0;
    this.RECORD_TYPE_SINGLE = 1;
    
    this.packets = [];
  }
  
  clean() {
    this.packets = [];
    
    return super.clean();
  }
  
  encodePayload() {
    let payload = new BinaryStream();
    this.packets = this.packets.sort();
    let count = this.packets.length;
    let records = 0;
    
    let start;
    let last;
    
    if (count > 0) {
      let pointer = 1;
      start = this.packets[0];
      last = this.packets[0];
      
      while (pointer < count) {
        let current = this.packets[pointer++];
        let diff = current - last;
        if (diff === 1) {
          last = current;
        } else if (diff > 1) {
          payload
            .writeBool(this.RECORD_TYPE_SINGLE)
            .writeLTriad(start, 0);
          start = last = current;
        } else {
          payload
            .wrieBool(this.RECORD_TYPE_RANGE)
            .writeLTriad(start, 0)
            .writeLTriad(last, 0);
          start = last = current;
        }
        ++records;
      }
    }
    
    if (start === last) {
      payload
        .writeBool(this.RECORD_TYPE_SINGLE)
        .writeLTriad(start, 0);
    } else {
      payload
        .wrieBool(this.RECORD_TYPE_RANGE)
        .writeLTriad(start, 0)
        .writeLTriad(last, 0);
    }
    ++records;
    
    this.writeShort(records);
    this.writeData(payload.getBuffer());
  }
  
  decodePayload() {
    let count = this.readShort();
    this.packets = [];
    let cnt = 0;
    
    let i;
    let c;
    
    for(i = 0; i < count && !this.feof() && cnt < 4096; i++) {
      if (this.readByte() === this.RECORD_TYPE_RANGE) {
        let start = this.readLTriad();
        let end = this.readLTriad();
        if ((end - start) > 512) {
          end = start + 512;
        }
        for(c = start; c <= end; ++c) {
          this.packets[cnt++] = c;
        }
      } else {
        this.packets[cnt++] = this.readLTriad();
      }
    }
  }
}

module.exports = AcknowledgePacket;