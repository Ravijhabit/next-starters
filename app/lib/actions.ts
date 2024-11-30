"use server";

import { z } from "zod";
import { sql } from "@vercel/postgres";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {signIn} from '@/auth';
import {AuthError} from 'next-auth';

export async function authenticate(prevState: string|undefined, formData: FormData,){
	try{
		await signIn('credentials', formData);
	}catch(error){
    console.log(error);
		if(error instanceof AuthError){
			switch(error.type){
				case 'CredentialsSignin':
					return 'Invalid credentials.';
				default: return 'Something went wrong.';
			}
		}
		throw error;
	}
}








export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["paid", "pending"], {
    invalid_type_error: "Please select an invoice status",
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
  const validationFields = CreateInvoice.safeParse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  console.log("validationFields", validationFields);
  console.log("validationFields error", validationFields.error?.flatten().fieldErrors);
  // if form validation fails, return errors early. Otherwise, continue.
  if (!validationFields.success) {
    return {
      errors: validationFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Create Invoice.",
    };
  }
  console.log('validationFields.data', validationFields.data);
  // prepare data for insertion into database
  const { customerId, amount, status } = validationFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];
  // Insert data into the database
  try {
    await sql`
            INSERT INTO invoices (customerid, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
            `;
  } catch (error) {
    return {
      message: "Database Error: Failed to Create Invoice.",
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  });
  const amountInCents = amount * 100;

  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `;
  } catch (error) {
    return {
      message: "Database Error: Failed to Update Invoice.",
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  try {
    await sql`
        DELETE FROM invoices
        WHERE id = ${id}
        `;
    revalidatePath("/dashboard/invoices");
    return {
      message: "Deleted Invoice!",
    };
  } catch (error) {
    return {
      message: "Database Error: Failed to Delete Invoice.",
    };
  }
}
