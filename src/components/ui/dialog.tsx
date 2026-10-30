import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = DialogPrimitive.Overlay;
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

export const DialogContent = DialogPrimitive.Content;
DialogContent.displayName = DialogPrimitive.Content.displayName;

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = DialogPrimitive.Title;
DialogTitle.displayName = DialogPrimitive.Title.displayName;

export const DialogDescription = DialogPrimitive.Description;
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export const DialogCloseButton = DialogPrimitive.Close;
DialogCloseButton.displayName = DialogPrimitive.Close.displayName;