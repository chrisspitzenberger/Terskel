"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateEmailAction } from "@/lib/actions/profile";
import { updateEmailSchema } from "@/lib/db/schemas";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function UpdateEmailForm({ initialEmail }: { initialEmail: string }) {
  const [isPending, setIsPending] = useState(false);

  const form = useForm<z.infer<typeof updateEmailSchema>>({
    resolver: zodResolver(updateEmailSchema),
    defaultValues: {
      email: initialEmail,
    },
  });

  async function onSubmit(values: z.infer<typeof updateEmailSchema>) {
    if (values.email === initialEmail) return;
    
    setIsPending(true);
    const res = await updateEmailAction(values);
    setIsPending(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success(res?.success || "Email updated");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="name@example.com" {...field} disabled={isPending} />
              </FormControl>
              <FormDescription>
                Note: Updating your email may require verification.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button disabled={isPending || form.watch("email") === initialEmail} type="submit">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Email
        </Button>
      </form>
    </Form>
  );
}
