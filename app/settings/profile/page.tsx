import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/drizzle-schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { UpdateNameForm } from "@/components/profile/update-name-form";
import { UpdateEmailForm } from "@/components/profile/update-email-form";
import { UpdatePasswordForm } from "@/components/profile/update-password-form";
import { DeleteAccountDialog } from "@/components/profile/delete-account-dialog";
import { ProfilePictureUpload } from "@/components/profile/profile-picture-upload";

export default async function ProfileSettingsPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await db.select().from(users).where(eq(users.id, session.user.id)).then(res => res[0]);

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container mx-auto max-w-4xl py-10 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <Separator />

      <div className="space-y-8">
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Profile Picture</h2>
            <p className="text-sm text-muted-foreground">
              Update your avatar.
            </p>
          </div>
          <ProfilePictureUpload currentImage={user.image} name={user.name} />
        </section>

        <Separator />

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Personal Information</h2>
            <p className="text-sm text-muted-foreground">
              Update your name.
            </p>
          </div>
          <div className="max-w-md">
            <UpdateNameForm initialName={user.name || ""} />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Email Address</h2>
            <p className="text-sm text-muted-foreground">
              Manage your email address.
            </p>
          </div>
          <div className="max-w-md">
            <UpdateEmailForm initialEmail={user.email || ""} />
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Password</h2>
            <p className="text-sm text-muted-foreground">
              Change your password.
            </p>
          </div>
          <div className="max-w-md">
            <UpdatePasswordForm hasPassword={!!user.password} />
          </div>
        </section>

        <Separator />

        <section className="space-y-4 border border-destructive/20 bg-destructive/5 p-6 rounded-lg">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and all associated data.
            </p>
          </div>
          <DeleteAccountDialog />
        </section>
      </div>
    </div>
  );
}
