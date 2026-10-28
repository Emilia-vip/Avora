import CoreImage
import ExpoModulesCore
import Vision

// Same "lift subject" feature as long-pressing a photo in the Photos app: free, offline, no quota.
public class GarmentCutoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GarmentCutout")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 17.0, *) {
        return true
      }
      return false
    }

    // Returns a file:// URI to a transparent PNG cropped to the garment.
    AsyncFunction("cutOutAsync") { (uri: String) -> String in
      guard #available(iOS 17.0, *) else {
        throw CutoutException("Cut-out needs iOS 17 or later.")
      }
      guard let url = URL(string: uri),
            let photo = CIImage(contentsOf: url, options: [.applyOrientationProperty: true]) else {
        throw CutoutException("Could not read the photo.")
      }

      let handler = VNImageRequestHandler(ciImage: photo)
      let request = VNGenerateForegroundInstanceMaskRequest()
      try handler.perform([request])

      guard let result = request.results?.first, !result.allInstances.isEmpty else {
        throw CutoutException("Couldn't find a garment in the photo.")
      }

      let masked = try result.generateMaskedImage(
        ofInstances: result.allInstances,
        from: handler,
        croppedToInstancesExtent: true
      )
      let image = CIImage(cvPixelBuffer: masked)
      guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
            let png = CIContext().pngRepresentation(of: image, format: .RGBA8, colorSpace: colorSpace) else {
        throw CutoutException("Could not save the cut-out.")
      }

      let output = FileManager.default.temporaryDirectory
        .appendingPathComponent("cutout-\(UUID().uuidString).png")
      try png.write(to: output)
      return output.absoluteString
    }
  }
}

final class CutoutException: GenericException<String> {
  override var reason: String {
    param
  }
}
