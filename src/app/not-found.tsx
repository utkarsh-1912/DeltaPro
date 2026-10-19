import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HalftoneField } from "@/components/motion";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[80vh] items-center overflow-hidden">
      <HalftoneField className="[--hx:85%] [--hy:50%]" />
      <div className="container relative mx-auto px-5 sm:px-8">
        <p className="font-mono-label text-muted-foreground">Error 404</p>
        <h1 className="mt-4 text-[clamp(5rem,20vw,16rem)] font-semibold leading-[0.85] tracking-[-0.06em]">404</h1>
        <p className="mt-6 max-w-md text-lg text-muted-foreground">
          This page does not exist or has been moved. Head back and pick up where you left off.
        </p>
        <Button asChild size="lg" className="mt-8 rounded-full">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" /> Return home
          </Link>
        </Button>
      </div>
    </div>
  );
}
