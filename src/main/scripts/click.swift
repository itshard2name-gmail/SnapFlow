import Foundation
import CoreGraphics

let args = CommandLine.arguments

if args.count < 3 {
    print("Usage: ./click <x> <y>")
    exit(1)
}

let x = Double(args[1]) ?? 0
let y = Double(args[2]) ?? 0

let point = CGPoint(x: x, y: y)

// Move
let move = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)
move?.post(tap: .cghidEventTap)

// Click Down
let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: point, mouseButton: .left)
down?.post(tap: .cghidEventTap)

// Tiny Delay for realism
usleep(50000) // 0.05s

// Click Up
let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: point, mouseButton: .left)
up?.post(tap: .cghidEventTap)

print("Clicked at X:\(x) Y:\(y)")
