"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadProfilePictureAction } from "@/lib/actions/profile";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

export function ProfilePictureUpload({ currentImage, name }: { currentImage?: string | null; name?: string | null }) {
  const [isPending, setIsPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fallback = name ? name.charAt(0).toUpperCase() : "U";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsPending(true);
    const res = await uploadProfilePictureAction(formData);
    setIsPending(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(res?.success || "Profile picture uploaded");
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center space-x-6">
      <Avatar className="h-24 w-24">
        <AvatarImage src={currentImage || undefined} alt="Profile Picture" />
        <AvatarFallback className="text-2xl">{fallback}</AvatarFallback>
      </Avatar>
      <div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isPending}
        />
        <Button
          variant="outline"
          disabled={isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Upload New Picture
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Recommended size: 256x256px. Maximum file size: 2MB.
        </p>
      </div>
    </div>
  );
}
