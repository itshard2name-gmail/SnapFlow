import Foundation
import CoreGraphics

let args = CommandLine.arguments
let times = args.count > 1 ? (Int(args[1]) ?? 1) : 1

// Usage: ./keypress <count> <keyCode>
// keyCode defaults to 125 (Down Arrow)
// 121 = Page Down
let keyCode = args.count > 2 ? (UInt16(args[2]) ?? 125) : 125
let source = CGEventSource(stateID: .hidSystemState)

print("Pressing Key \(keyCode), \(times) times...")

for _ in 0..<times {
    let keyDown = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: true)
    let keyUp = CGEvent(keyboardEventSource: source, virtualKey: CGKeyCode(keyCode), keyDown: false)
    
    keyDown?.post(tap: .cghidEventTap)
    usleep(50000) // 50ms hold
    keyUp?.post(tap: .cghidEventTap)
    
    usleep(100000) // 100ms delay between presses
}

print("Done.")
