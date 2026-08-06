import React, { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Camera, Upload, Check, RefreshCcw } from "lucide-react";
import Webcam from "react-webcam";
import imageCompression from "browser-image-compression";
import { toast } from "sonner";

interface ImageUploadDialogProps {
  onClose: () => void;
  onUploadSuccess: (url: string) => void;
  title?: string;
}

export function ImageUploadDialog({ onClose, onUploadSuccess, title = "Update Profile Photo" }: ImageUploadDialogProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const webcamRef = useRef<Webcam>(null);

  const handleCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setCapturedImage(imageSrc);
    }
  }, [webcamRef]);

  const handleRetake = () => {
    setCapturedImage(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleSave = async () => {
    if (!capturedImage) return;

    try {
      setIsUploading(true);
      
      // Convert base64 to File
      const imageFile = dataURLtoFile(capturedImage, "profile.jpg");

      // Compress image
      const options = {
        maxSizeMB: 0.15, // Max 150kb
        maxWidthOrHeight: 800,
        useWebWorker: true,
        fileType: "image/jpeg"
      };
      
      const compressedFile = await imageCompression(imageFile, options);

      // Upload to Cloudinary
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary credentials are not configured in .env");
      }

      const formData = new FormData();
      formData.append("file", compressedFile);
      formData.append("upload_preset", uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image to Cloudinary");
      }

      const data = await response.json();
      
      toast.success("Image uploaded successfully!");
      onUploadSuccess(data.secure_url);
      onClose();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to save image.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Take a clear photo showing the member's face, or upload one.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {capturedImage ? (
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
                <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              </div>
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleRetake} disabled={isUploading}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Retake Photo
                </Button>
              </div>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="camera">
                  <Camera className="h-4 w-4 mr-2" />
                  Camera
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="camera" className="mt-0 space-y-4">
                <div className="overflow-hidden rounded-lg border bg-black flex justify-center items-center aspect-square">
                  <Webcam
                    audio={false}
                    ref={webcamRef}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ facingMode: "user", aspectRatio: 1 }}
                    className="w-full h-full object-cover"
                  />
                </div>
                <Button className="w-full" onClick={handleCapture}>
                  <Camera className="mr-2 h-4 w-4" />
                  Capture Photo
                </Button>
              </TabsContent>
              
              <TabsContent value="upload" className="mt-0">
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4 aspect-square">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-center text-muted-foreground">
                    Click below to select a photo from your device.
                  </p>
                  <Input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleFileUpload} 
                    className="cursor-pointer"
                  />
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!capturedImage || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Save Photo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
