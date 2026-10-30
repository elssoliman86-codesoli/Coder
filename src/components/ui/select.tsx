import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = SelectPrimitive.Trigger;
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectContent = SelectPrimitive.Content;
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectLabel = SelectPrimitive.Label;
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export const SelectItem = SelectPrimitive.Item;
SelectItem.displayName = SelectPrimitive.Item.displayName;

export const SelectSeparator = SelectPrimitive.Separator;
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

type SelectItemProps = React.ComponentPropsWithoutRef<typeof SelectItem> & {
  children: React.ReactNode;
  value: string;
};

export const SelectItemCustom = ({ className, children, value, disabled, ...props }: SelectItemProps) => (
  <SelectItem value={value} disabled={disabled} {...props}>
    <SelectItemText className={cn('relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectItemIndicator>
          <Check className="h-4 w-4" />
        </SelectItemIndicator>
      </span>
      <SelectItemText>{children}</SelectItemText>
    </SelectItemText>
  </SelectItem>
);

export const SelectScrollUpButton = SelectPrimitive.ScrollUpButton;
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

export const SelectScrollDownButton = SelectPrimitive.ScrollDownButton;
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

export const SelectSeparatorCustom = SelectPrimitive.Separator;
SelectSeparatorCustom.displayName = SelectPrimitive.Separator.displayName;

const SelectItemText = SelectPrimitive.ItemText;
SelectItemText.displayName = SelectPrimitive.ItemText.displayName;

const SelectItemIndicator = SelectPrimitive.ItemIndicator;
SelectItemIndicator.displayName = SelectPrimitive.ItemIndicator.displayName;