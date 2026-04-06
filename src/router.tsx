import { createBrowserRouter } from "react-router-dom";
import { EditorPage } from "./features/editor/EditorPage";
import { LandingPage } from "./features/landing/LandingPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/database/:id",
    element: <EditorPage />,
  },
]);
