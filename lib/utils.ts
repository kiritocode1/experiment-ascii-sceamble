import {twMerge} from "tailwind-merge"
import clsx from "clsx"

export const cn = (base: string, ...args: string[]) => twMerge(clsx(base, ...args))
