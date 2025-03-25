import { useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSubBlockValue } from '../hooks/use-sub-block-value'

interface DropdownProps {
  options: Array<string | { label: string; id: string; icon?: (props: { className?: string }) => React.ReactNode }>
  defaultValue?: string
  blockId: string
  subBlockId: string
}

export function Dropdown({ options, defaultValue, blockId, subBlockId }: DropdownProps) {
  const [value, setValue] = useSubBlockValue(blockId, subBlockId, true)

  // Set the value to the first option if it's not set
  useEffect(() => {
    if (!value && options.length > 0) {
      const firstOption = options[0]
      const firstValue = typeof firstOption === 'string' ? firstOption : firstOption.id
      setValue(firstValue)
    }
  }, [value, options, defaultValue, setValue])

  const getOptionValue = (option: string | { label: string; id: string }) => {
    return typeof option === 'string' ? option : option.id
  }

  const getOptionLabel = (option: string | { label: string; id: string }) => {
    return typeof option === 'string' ? option : option.label
  }
  
  const getOptionIcon = (option: string | { label: string; id: string; icon?: (props: { className?: string }) => React.ReactNode }) => {
    if (typeof option === 'string' || !option.icon) return null;
    return option.icon({ className: 'h-4 w-4' });
  }

  return (
    <Select
      value={value as string | undefined}
      defaultValue={defaultValue ?? getOptionValue(options[0])}
      onValueChange={(value) => setValue(value)}
    >
      <SelectTrigger className="text-left">
        <SelectValue placeholder="Select an option" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={getOptionValue(option)} value={getOptionValue(option)}>
            <div className="flex items-center gap-2">
              {getOptionIcon(option)}
              <span>{getOptionLabel(option)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
