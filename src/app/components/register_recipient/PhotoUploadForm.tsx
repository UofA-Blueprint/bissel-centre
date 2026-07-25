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

export type PhotoUploadData = { imageUrl: string };
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_BASE64_FIELD_BYTES = 1_000_000;
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

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        onCancel();
      }
    };
    startCamera();
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
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
          onClick={onCancel}
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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Clean up blob URLs when component unmounts or when previewUrl changes
    useEffect(() => {
      return () => {
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      };
    }, [previewUrl]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        if (file.size > MAX_UPLOAD_BYTES) {
          onError?.("File is too large. Please select an image under 2MB.");
          return;
        }
        // Revoke the previous blob URL before creating a new one
        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setView("preview");
        onError?.(null);
      }
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
        context.clearRect(0, 0, width, height);
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

    const collect = (): PhotoUploadData | null => {
      if (previewUrl) {
        return { imageUrl: previewUrl };
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

          clearInterval(progressInterval);
          setUploadProgress(100);
          setIsUploading(false);

          // Submit the base64 string
          onSubmit({ imageUrl: base64String });
        } catch (error) {
          console.error("Error converting image:", error);
          onError?.("Failed to process image");
          setIsUploading(false);
        }
      } else if (previewUrl) {
        // If a photo exists from initialData but wasn't changed, just proceed.
        onSubmit({ imageUrl: previewUrl });
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
          {/* --- The entire JSX remains exactly the same --- */}

          {view === "initial" && (
            <div className="text-center space-y-4">
              <p className="font-semibold">Browse a file or use webcam</p>
              <p className="text-sm text-gray-500">
                PNG and JPEG formats, up to 2 MB
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
            accept="image/png, image/jpeg"
            onChange={handleFileChange}
          />
        </div>
      </div>
    );
  },
);

PhotoUploadForm.displayName = "PhotoUploadForm";
export default PhotoUploadForm;
