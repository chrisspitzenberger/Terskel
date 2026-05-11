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
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { updateNameAction } from "@/lib/actions/profile";
import { updateNameSchema } from "@/lib/db/schemas";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { useSession } from "next-auth/react";

export function UpdateNameForm({ initialName }: { initialName: string }) {
  const [isPending, setIsPending] = useState(false);
  const { update } = useSession();

  const form = useForm<z.infer<typeof updateNameSchema>>({
    resolver: zodResolver(updateNameSchema),
    defaultValues: {
      name: initialName,
    },
  });

  async function onSubmit(values: z.infer<typeof updateNameSchema>) {
    if (values.name === initialName) return;
    
    setIsPending(true);
    const res = await updateNameAction(values);
    setIsPending(false);

    if (res?.error) {
      toast.error(res.error);
    } else {
      await update({ name: res.name });
      toast.success(res?.success || "Name updated");
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Your Name" {...field} disabled={isPending} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button disabled={isPending || form.watch("name") === initialName} type="submit">
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Update Name
        </Button>
      </form>
    </Form>
  );
}
