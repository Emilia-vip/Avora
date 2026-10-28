package expo.modules.garmentcutout

import android.graphics.Bitmap
import android.net.Uri
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.UUID

// Google ML Kit subject segmentation: runs on the phone, free, offline once the model is downloaded.
class GarmentCutoutModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GarmentCutout")

    Function("isAvailable") { true }

    // Returns a file:// URI to a transparent PNG cropped to the garment.
    AsyncFunction("cutOutAsync") { uri: String ->
      val context = appContext.reactContext ?: throw CodedException("The app is not ready yet.")
      val photo = InputImage.fromFilePath(context, Uri.parse(uri))

      val options = SubjectSegmenterOptions.Builder().enableForegroundBitmap().build()
      val segmenter = SubjectSegmentation.getClient(options)
      val foreground = try {
        Tasks.await(segmenter.process(photo)).foregroundBitmap
      } finally {
        segmenter.close()
      }
      val cutout = foreground?.let(::cropToContent)
        ?: throw CodedException("Couldn't find a garment in the photo.")

      val output = File(context.cacheDir, "cutout-${UUID.randomUUID()}.png")
      output.outputStream().use { cutout.compress(Bitmap.CompressFormat.PNG, 100, it) }
      Uri.fromFile(output).toString()
    }
  }

  /** ML Kit keeps the full photo size, so trim the transparent edges like the iOS version does. */
  private fun cropToContent(bitmap: Bitmap): Bitmap? {
    val width = bitmap.width
    val height = bitmap.height
    val pixels = IntArray(width * height)
    bitmap.getPixels(pixels, 0, width, 0, 0, width, height)

    var left = width
    var top = height
    var right = -1
    var bottom = -1
    for (y in 0 until height) {
      for (x in 0 until width) {
        if (pixels[y * width + x] ushr 24 != 0) {
          if (x < left) left = x
          if (x > right) right = x
          if (y < top) top = y
          if (y > bottom) bottom = y
        }
      }
    }
    if (right < 0) return null
    return Bitmap.createBitmap(bitmap, left, top, right - left + 1, bottom - top + 1)
  }
}
