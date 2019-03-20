import "allocator/arena";

declare function rut_storageStore(pathOffset: i32, valueOffset: i32): string;
declare function rut_getAddress(resultPointer: i32): string;
declare function rut_getCallDataSize(): i32;
declare function rut_revert(offset: i32, length: i32): i32;
declare function rut_callDataCopy(resultOffset: i32, dataOffset: i32, length: i32): i32;
declare function rut_storageLoad(pathOffset: i32, resultOffset: i32): i32;
declare function rut_finish(dataOffset: i32, dataLength: i32): i32;
declare function rut_getCaller(resultOffset: i32): i32;
declare function rut_log(dataOffset: i32, length: i32): i32;

export function main(): void {
  if (rut_getCallDataSize() < 4) {
    rut_revert(0, 0);
  }

  let ptrSelector = <i32>memory.allocate(4);
  rut_callDataCopy(ptrSelector, 0, 4);
  let selector = load<i32>(ptrSelector);

  switch(selector) {
    case 0x9993021a:
      do_balance();
      break;
    case 0x5d359fbd:
      do_transfer();
      break;
    default:
      rut_revert(0, 0);
  }

  let ptrAddress = <i32>memory.allocate(32);
  // Pointer will be filled with address
  rut_getAddress(ptrAddress);

  // Send address back to storage store and add 100 as value.
  rut_storageStore(ptrAddress, 100);
}

function do_balance(): void {
  if (rut_getCallDataSize() !== 24) {
    rut_revert(0, 0);
  }

  // Address in RUT is 32
  let ptrAddress = <i32>memory.allocate(20);
  rut_callDataCopy(ptrAddress, 4, 20);
  let ptrBalance = <i32>memory.allocate(32);
  rut_storageLoad(ptrAddress, ptrBalance);
  rut_finish(ptrBalance, 32);
}

function do_transfer(): void {
  if (rut_getCallDataSize() !== 32) {
    rut_revert(0, 0);
  }

  let ptrSender = <i32>memory.allocate(32);
  rut_getCaller(ptrSender);
  let ptrRecipient = <i32>memory.allocate(32);
  rut_callDataCopy(ptrRecipient, 4, 20);
  let ptrValue = <i32>memory.allocate(32);
  rut_callDataCopy(ptrValue, 24, 8);

  let ptrSenderBalance = <i32>memory.allocate(32);
  let ptrRecipientBalance = <i32>memory.allocate(32);

  rut_storageLoad(ptrSender, ptrSenderBalance);
  rut_storageLoad(ptrRecipient, ptrRecipientBalance);

  let senderBalance = load<i32>(ptrSenderBalance);
  let recipientBalance = load<i32>(ptrRecipientBalance);
  let value = load<i32>(ptrValue);

  if (senderBalance < value) {
    rut_revert(0, 0);
  }

  store<i32>(ptrSenderBalance, senderBalance - value);
  store<i32>(ptrRecipientBalance, recipientBalance + value);
  rut_storageStore(ptrSender, ptrSenderBalance);
  rut_storageStore(ptrRecipient, ptrRecipientBalance);
}
