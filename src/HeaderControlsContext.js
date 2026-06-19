import { createContext, useContext } from 'react'
export const HeaderControlsContext = createContext({ setControls: () => {} })
export const useHeaderControls = () => useContext(HeaderControlsContext)
