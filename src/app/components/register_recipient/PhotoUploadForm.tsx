import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  useRef,
} from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import SearchIcon from "../icons/SearchIcon";
import CameraIcon from "../icons/CameraIcon";

export type PhotoUploadData = { imageUrl: string; thumbnail?: string };
// Soft limit: files above this show a warning with a "Force upload" override
// (the image is then heavily compressed client-side; the server still
// enforces its own 1 MB stored-size and mimetype checks regardless).
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
// Hard ceiling: decoding larger files into a canvas can freeze or crash
// low-memory devices, so there is no override past this point.
const ABSOLUTE_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
const ACCEPTED_TYPES_LABEL = "JPEG, PNG, WebP, AVIF or GIF";
const MAX_BASE64_FIELD_BYTES = 1_000_000;
// List views render 36-48px avatars; a 96px JPEG keeps the user doc small
// while the full-res base64 lives in the user_photos collection.
const THUMBNAIL_MAX_DIMENSION = 96;
const THUMBNAIL_QUALITY = 0.75;
type Props = {
  onSubmit: (data: PhotoUploadData) => void;
  onError?: (msg: string | null) => void;
  initialData?: Partial<PhotoUploadData>;
};

// --- WebcamCapture component remains exactly the same ---
const WebcamCapture = ({
  onCapture,
  onCancel,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    let cancelled = false;
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Error accessing webcam:", err);
          onCancel();
        }
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [onCancel]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas
      .getContext("2d")
      ?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `webcam-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        stopCamera();
        onCapture(file);
      }
    }, "image/jpeg");
  };

  return (
    <div className="w-full flex flex-col items-center space-y-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full max-w-md rounded-lg"
      />
      <canvas ref={canvasRef} className="hidden" />
      <div className="flex space-x-4">
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCapture}
          className="px-4 py-2 bg-primary text-white rounded-lg"
        >
          Capture
        </button>
      </div>
    </div>
  );
};

// --- Main Photo Upload Form ---
const PhotoUploadForm = forwardRef<{ submit: () => void }, Props>(
  ({ onSubmit, onError, initialData = {} }, ref) => {
    const [view, setView] = useState<"initial" | "preview" | "webcam">(
      initialData.imageUrl ? "preview" : "initial",
    );
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(
      initialData.imageUrl ?? null,
    );
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [oversizeFile, setOversizeFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Clean up blob URLs when component unmounts or when previewUrl changes
    useEffect(() => {
      return () => {
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }, [previewUrl]);

    const acceptFile = (file: File) => {
      // Revoke the previous blob URL before creating a new one
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setOversizeFile(null);
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setView("preview");
      onError?.(null);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Allow re-selecting the same file after a cancel.
      event.target.value = "";
      if (!file) return;

      if (!ACCEPTED_TYPES.includes(file.type)) {
        onError?.(`Only ${ACCEPTED_TYPES_LABEL} images are supported.`);
        return;
      }
      if (file.size > ABSOLUTE_MAX_UPLOAD_BYTES) {
        onError?.(
          `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the maximum is 15 MB.`,
        );
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        // Soft limit: hold the file and offer an explicit force-upload.
        setOversizeFile(file);
        onError?.(null);
        return;
      }
      acceptFile(file);
    };

    const handleWebcamCapture = (file: File) => {
      // Revoke the previous blob URL before creating a new one
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setView("preview");
    };

    const dataUrlByteLength = (dataUrl: string): number => {
      return new TextEncoder().encode(dataUrl).length;
    };

    const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(image);
        };
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Failed to load image."));
        };
        image.src = objectUrl;
      });
    };

    const compressToBase64WithinLimit = async (
      file: File,
      maxFieldBytes: number,
    ): Promise<string> => {
      const image = await loadImageFromFile(file);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to prepare image compression.");
      }

      let scale = 1;
      let quality = 0.9;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        canvas.width = width;
        canvas.height = height;
        // JPEG has no alpha — flatten transparent PNGs onto white, not black.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);

        const candidate = canvas.toDataURL("image/jpeg", quality);
        if (dataUrlByteLength(candidate) <= maxFieldBytes) {
          return candidate;
        }

        if (quality > 0.55) {
          quality -= 0.1;
        } else {
          scale *= 0.85;
        }
      }

      throw new Error(
        "Image is too large after compression. Please use a smaller photo.",
      );
    };

    const makeThumbnail = async (file: File): Promise<string> => {
      const image = await loadImageFromFile(file);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Failed to prepare thumbnail.");
      }
      const scale = Math.min(
        1,
        THUMBNAIL_MAX_DIMENSION / Math.max(image.width, image.height),
      );
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      // JPEG has no alpha — flatten transparent PNGs onto white, not black.
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", THUMBNAIL_QUALITY);
    };

    const collect = (): PhotoUploadData | null => {
      if (previewUrl) {
        return { imageUrl: previewUrl, thumbnail: initialData.thumbnail };
      }
      return null;
    };

    const validate = (): string | null => {
      if (!previewUrl) {
        return "Please upload a photo of the recipient";
      }
      return null;
    };

    // MODIFIED: Convert to base64 instead of simulating upload
    const handleUpload = async () => {
      const validationError = validate();
      if (validationError) {
        onError?.(validationError);
        return;
      }

      if (imageFile) {
        setIsUploading(true);
        setUploadProgress(0);

        try {
          // Animate progress while converting
          const progressInterval = setInterval(() => {
            setUploadProgress((prev) => Math.min(prev + 10, 90));
          }, 150);

          // Convert to base64 and compress to stay within Firestore field size.
          const base64String = await compressToBase64WithinLimit(
            imageFile,
            MAX_BASE64_FIELD_BYTES,
          );
          const thumbnail = await makeThumbnail(imageFile);

          clearInterval(progressInterval);
          setUploadProgress(100);
          setIsUploading(false);

          // Submit the base64 string
          onSubmit({ imageUrl: base64String, thumbnail });
        } catch (error) {
          console.error("Error converting image:", error);
          onError?.("Failed to process image");
          setIsUploading(false);
        }
      } else if (previewUrl) {
        // If a photo exists from initialData but wasn't changed, just proceed.
        onSubmit({ imageUrl: previewUrl, thumbnail: initialData.thumbnail });
      }
    };

    useImperativeHandle(ref, () => ({
      submit: handleUpload,
      getData: collect,
      validate,
    }));

    return (
      <div className="space-y-4">
        <h1 className="text-xl font-medium text-gray-800">
          Upload a photo of the recipient
        </h1>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px]">
          {oversizeFile && (
            <div className="mb-6 w-full max-w-md rounded-lg border border-amber-300 bg-amber-50 p-4 text-center space-y-3">
              <p className="text-sm font-semibold text-amber-800">
                This photo is {(oversizeFile.size / (1024 * 1024)).toFixed(1)}{" "}
                MB — over the 2 MB recommended limit.
              </p>
              <p className="text-xs text-amber-700">
                You can still upload it; it will be heavily compressed to fit,
                which may reduce photo quality.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => acceptFile(oversizeFile)}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
                >
                  Force Upload
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOversizeFile(null);
                    fileInputRef.current?.click();
                  }}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Choose Another
                </button>
              </div>
            </div>
          )}

          {view === "initial" && (
            <div className="text-center space-y-4">
              <p className="font-semibold">Browse a file or use webcam</p>
              <p className="text-sm text-gray-500">
                {ACCEPTED_TYPES_LABEL} · up to 2 MB recommended
              </p>
              <div className="w-32 h-32 bg-gray-200 rounded-full mx-auto my-4"></div>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <SearchIcon className="w-5 h-5" />
                  <span>Browse</span>
                </button>
                <button
                  type="button"
                  onClick={() => setView("webcam")}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <CameraIcon className="w-5 h-5" />
                  <span>Camera</span>
                </button>
              </div>
            </div>
          )}

          {view === "preview" && (
            <div className="text-center space-y-4">
              <div className="relative w-48 h-48">
                {isUploading && (
                  <div className="absolute inset-0">
                    <CircularProgressbar
                      value={uploadProgress}
                      text={`${uploadProgress}%`}
                      styles={buildStyles({
                        pathColor: "#3B82F6",
                        textColor: "#3B82F6",
                      })}
                    />
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl!}
                  alt="Recipient Preview"
                  className={`w-full h-full object-cover rounded-full ${
                    isUploading ? "opacity-30" : ""
                  }`}
                />
              </div>
              {!isUploading && (
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm text-primary hover:underline"
                  >
                    Change Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Revoke blob URL before removing
                      if (previewUrl && previewUrl.startsWith("blob:")) {
                        URL.revokeObjectURL(previewUrl);
                      }
                      setImageFile(null);
                      setPreviewUrl(null);
                      setView("initial");
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {view === "webcam" && (
            <WebcamCapture
              onCapture={handleWebcamCapture}
              onCancel={() => setView("initial")}
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_TYPES.join(", ")}
            onChange={handleFileChange}
          />
        </div>
      </div>
    );
  },
);

PhotoUploadForm.displayName = "PhotoUploadForm";
export default PhotoUploadForm;
