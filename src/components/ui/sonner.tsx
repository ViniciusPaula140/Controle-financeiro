import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      closeButton
      className="toaster group z-[200] pointer-events-none"
      toastOptions={{
        classNames: {
          toast:
            "group toast pointer-events-auto group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground pointer-events-auto",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground pointer-events-auto",
          closeButton: "pointer-events-auto !opacity-100",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
