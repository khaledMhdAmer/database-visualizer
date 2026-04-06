import { RouterProvider } from "react-router-dom";
import { useEffect } from "react";
import { router } from "./router";
import { useSchemaStore } from "./store/useSchemaStore";

export default function App() {
  const initialize = useSchemaStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <RouterProvider router={router} />;
}
