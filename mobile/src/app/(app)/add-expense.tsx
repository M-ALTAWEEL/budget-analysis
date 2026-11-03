import { Redirect } from "expo-router";
import { useEffect } from "react";

import { useExpenseSheet } from "@/components/expense/ExpenseSheet";

/** budgetanalysis://add-expense, from the home-screen widget (feature F12): the overview,
 *  with the new-expense sheet open. */
export default function AddExpenseLink() {
  const openSheet = useExpenseSheet();
  useEffect(() => {
    openSheet();
  }, [openSheet]);
  return <Redirect href="/" />;
}
