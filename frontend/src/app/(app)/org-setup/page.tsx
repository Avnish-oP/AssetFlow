"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/shared/Toast";
import { apiFetch, type User } from "@/lib/api";

type Department = { id: number; name: string; status: string };
type Category = { id: number; name: string; custom_fields: Record<string, unknown> };

export default function OrgSetupPage() {
  const [tab, setTab] = useState("departments");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    apiFetch<Department[]>("/departments").then(setDepartments).catch(() => setDepartments([]));
    apiFetch<Category[]>("/categories").then(setCategories).catch(() => setCategories([]));
    apiFetch<User[]>("/employees").then(setEmployees).catch(() => setEmployees([]));
  }, []);

  async function createDepartment(form: FormData) {
    const name = form.get("name") as string;
    try {
      const item = await apiFetch<Department>("/departments", { method: "POST", body: JSON.stringify({ name }) });
      setDepartments((current) => [item, ...current]);
      showToast("Department created", "success");
    } catch (error) {
      const apiError = error as { status?: number; detail?: unknown };
      if (apiError.status === 409 || apiError.status === 400) {
        const detailStr = typeof apiError.detail === "string" ? apiError.detail : `Department "${name}" already exists`;
        showToast(detailStr, "error");
      } else {
        showToast("Failed to create department", "error");
      }
      throw new Error(); // Re-throw to prevent form reset in child
    }
  }

  async function createCategory(form: FormData) {
    const name = form.get("name") as string;
    try {
      const item = await apiFetch<Category>("/categories", { method: "POST", body: JSON.stringify({ name, custom_fields: {} }) });
      setCategories((current) => [item, ...current]);
      showToast("Category created", "success");
    } catch (error) {
      const apiError = error as { status?: number; detail?: unknown };
      if (apiError.status === 409 || apiError.status === 400) {
        const detailStr = typeof apiError.detail === "string" ? apiError.detail : `Category "${name}" already exists`;
        showToast(detailStr, "error");
      } else {
        showToast("Failed to create category", "error");
      }
      throw new Error();
    }
  }

  async function promote(employee: User, role: string) {
    try {
      const updated = await apiFetch<User>(`/employees/${employee.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      setEmployees((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      showToast(`Promoted to ${role.replace("_", " ")}`, "success");
    } catch {
      showToast("Failed to change role", "error");
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Organization setup</h1>
        <p className="text-sm text-secondary">Departments, categories, and employee roles.</p>
      </header>
      <div className="flex gap-2">
        {["departments", "categories", "employees"].map((item) => (
          <button key={item} className={tab === item ? buttonClass : secondaryButtonClass} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>
      {tab === "departments" ? (
        <SectionForm label="Department name" onSubmit={createDepartment} />
      ) : tab === "categories" ? (
        <SectionForm label="Category name" onSubmit={createCategory} />
      ) : null}
      {tab === "departments" ? (
        <DataTable headers={["Name", "Status"]}>
          {departments.map((department) => (
            <tr key={department.id}><td className="px-4 py-3">{department.name}</td><td className="px-4 py-3"><StatusPill value={department.status} /></td></tr>
          ))}
        </DataTable>
      ) : tab === "categories" ? (
        <DataTable headers={["Name", "Custom fields"]}>
          {categories.map((category) => (
            <tr key={category.id}><td className="px-4 py-3">{category.name}</td><td className="px-4 py-3 text-secondary">{Object.keys(category.custom_fields).join(", ") || "None"}</td></tr>
          ))}
        </DataTable>
      ) : (
        <DataTable headers={["Name", "Email", "Role", "Actions"]}>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td className="px-4 py-3">{employee.name}</td>
              <td className="px-4 py-3 text-secondary">{employee.email}</td>
              <td className="px-4 py-3"><StatusPill value={employee.role} /></td>
              <td className="space-x-2 px-4 py-3">
                <button className={secondaryButtonClass} onClick={() => promote(employee, "dept_head")}>Dept head</button>
                <button className={secondaryButtonClass} onClick={() => promote(employee, "asset_manager")}>Asset manager</button>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function SectionForm({ label, onSubmit }: { label: string; onSubmit: (form: FormData) => Promise<void> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  return (
    <form
      className="flex max-w-xl items-end gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        setIsSubmitting(true);
        try {
          await onSubmit(new FormData(form));
          form.reset();
        } catch (error) {
          // Ignored: parent handles the toast, we just want to skip form.reset()
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      <div className="flex-1">
        <FormField label={label}><input className={inputClass} name="name" required /></FormField>
      </div>
      <button disabled={isSubmitting} className={buttonClass}>
        {isSubmitting ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

