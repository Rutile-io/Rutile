import "allocator/arena";

let counter: i32 = 0;

declare function rut_storageStore(pathOffset: i32, valueOffset: i32): string;
declare function rut_getAddress(resultPointer: i32): string;

export function main(): i32 {
  let ptrAddress = <i32>memory.allocate(32);
  // Pointer will be filled with address
  rut_getAddress(ptrAddress);

  // Send address back to storage store and add 100 as value.
  rut_storageStore(ptrAddress, 100);
  counter += 1;
  return counter;
}
