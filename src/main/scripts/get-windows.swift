import Cocoa
import CoreGraphics

// Structure for JSON output
struct WindowInfo: Codable {
    let id: Int
    let pid: Int
    let app: String
    let title: String
    let x: Int
    let y: Int
    let width: Int
    let height: Int
}

// Get all windows on screen
let options = CGWindowListOption(arrayLiteral: .optionOnScreenOnly, .excludeDesktopElements)
guard let windowList = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else {
    print("[]")
    exit(0)
}

var windows: [WindowInfo] = []

for entry in windowList {
    // Extract basic properties
    guard let id = entry[kCGWindowNumber as String] as? Int,
          let pid = entry[kCGWindowOwnerPID as String] as? Int,
          let boundsDict = entry[kCGWindowBounds as String] as? [String: Any],
          let width = boundsDict["Width"] as? Int,
          let height = boundsDict["Height"] as? Int,
          let x = boundsDict["X"] as? Int,
          let y = boundsDict["Y"] as? Int else {
        continue
    }
    
    // Filter out tiny windows or zero-size windows
    if width < 50 || height < 50 { continue }

    // Owner Name (App Name)
    let app = (entry[kCGWindowOwnerName as String] as? String) ?? "Unknown"
    
    // Window Title (might be empty if no permission or no title)
    let title = (entry[kCGWindowName as String] as? String) ?? ""
    
    // Layer (0 is normal window)
    let layer = (entry[kCGWindowLayer as String] as? Int) ?? 0
    if layer != 0 { continue } 
    
    // Alpha - skip invisible windows
    let alpha = (entry[kCGWindowAlpha as String] as? Double) ?? 1.0
    if alpha < 0.1 { continue }

    windows.append(WindowInfo(
        id: id,
        pid: pid,
        app: app,
        title: title,
        x: x, 
        y: y, 
        width: width, 
        height: height
    ))
}

// Convert to JSON and print
let encoder = JSONEncoder()
if let jsonData = try? encoder.encode(windows),
   let jsonString = String(data: jsonData, encoding: .utf8) {
    print(jsonString)
} else {
    print("[]")
}
