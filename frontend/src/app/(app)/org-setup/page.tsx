"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { buttonClass, FormField, inputClass, secondaryButtonClass } from "@/components/shared/FormField";
import { StatusPill } from "@/components/shared/StatusPill";
import { useToast } from "@/components/shared/Toast";
import { apiFetch, type User } from "@/lib/api";

type Department = { id: number; name: string; status: string; head_id?: number | null; parent_department_id?: number | null };
type Category = { id: number; name: string; custom_fields: Record<string, unknown> };

export default function OrgSetupPage() {
  const [tab, setTab] = useState("departments");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const { showToast } = useToast();
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const [nextDepartments, nextCategories, nextEmployees] = await Promise.all([
        apiFetch<Department[]>("/departments"),
        apiFetch<Category[]>("/categories"),
        apiFetch<User[]>("/employees"),
      ]);
      setDepartments(nextDepartments);
      setCategories(nextCategories);
      setEmployees(nextEmployees);
    } catch {
      setError("Could not load organization data. Check that you are signed in as admin/manager.");
    }
  }

  useEffect(() => {
    void refresh();
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

  async function deactivateDepartment(department: Department) {
    const updated = await apiFetch<Department>(`/departments/${department.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: department.status === "active" ? "inactive" : "active" }),
    });
    setDepartments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function deleteDepartment(department: Department) {
    await apiFetch(`/departments/${department.id}`, { method: "DELETE" });
    setDepartments((current) => current.filter((item) => item.id !== department.id));
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

  async function deleteCategory(category: Category) {
    await apiFetch(`/categories/${category.id}`, { method: "DELETE" });
    setCategories((current) => current.filter((item) => item.id !== category.id));
  }

  async function createEmployee(form: FormData) {
    const departmentValue = String(form.get("department_id") || "");
    const item = await apiFetch<User>("/employees", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        department_id: departmentValue ? Number(departmentValue) : null,
      }),
    });
    setEmployees((current) => [item, ...current]);
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

  async function toggleEmployeeStatus(employee: User) {
    const updated = await apiFetch<User>(`/employees/${employee.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: employee.status === "active" ? "inactive" : "active" }),
    });
    setEmployees((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function deleteEmployee(employee: User) {
    await apiFetch(`/employees/${employee.id}`, { method: "DELETE" });
    setEmployees((current) => current.filter((item) => item.id !== employee.id));
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-xl font-semibold">Organization setup</h1>
        <p className="text-sm text-secondary">Departments, categories, and employee directory.</p>
      </header>
      {error ? <p className="text-sm text-red">{error}</p> : null}
      <div className="flex gap-2">
        {["departments", "categories", "employees"].map((item) => (
          <button key={item} className={tab === item ? buttonClass : secondaryButtonClass} onClick={() => setTab(item)}>
            {item}
          </button>
        ))}
      </div>

      {tab === "departments" ? (
        <>
          <SectionForm label="Department name" onSubmit={createDepartment} />
          <DataTable headers={["Name", "Status", "Actions"]}>
            {departments.map((department) => (
              <tr key={department.id}>
                <td className="px-4 py-3">{department.name}</td>
                <td className="px-4 py-3">
                  <StatusPill value={department.status} />
                </td>
                <td className="space-x-2 px-4 py-3">
                  <button className={secondaryButtonClass} onClick={() => void deactivateDepartment(department)}>
                    {department.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button className={secondaryButtonClass} onClick={() => void deleteDepartment(department)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      ) : null}

      {tab === "categories" ? (
        <>
          <SectionForm label="Category name" onSubmit={createCategory} />
          <DataTable headers={["Name", "Custom fields", "Actions"]}>
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-3">{category.name}</td>
                <td className="px-4 py-3 text-secondary">{Object.keys(category.custom_fields).join(", ") || "None"}</td>
                <td className="px-4 py-3">
                  <button className={secondaryButtonClass} onClick={() => void deleteCategory(category)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      ) : null}

      {tab === "employees" ? (
        <>
          <form
            className="grid gap-3 rounded-lg border border-line bg-surface p-4 md:grid-cols-5"
            onSubmit={async (event) => {
              event.preventDefault();
              await createEmployee(new FormData(event.currentTarget));
              event.currentTarget.reset();
            }}
          >
            <FormField label="Name">
              <input className={inputClass} name="name" required />
            </FormField>
            <FormField label="Email">
              <input className={inputClass} name="email" type="email" required />
            </FormField>
            <FormField label="Temp password">
              <input className={inputClass} name="password" type="password" minLength={6} required />
            </FormField>
            <FormField label="Department">
              <select className={inputClass} name="department_id" defaultValue="">
                <option value="">Unassigned</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </FormField>
            <button className={`${buttonClass} mt-6`}>Add employee</button>
          </form>
          <DataTable headers={["Name", "Email", "Role", "Status", "Actions"]}>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td className="px-4 py-3">{employee.name}</td>
                <td className="px-4 py-3 text-secondary">{employee.email}</td>
                <td className="px-4 py-3">
                  <StatusPill value={employee.role} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill value={employee.status} />
                </td>
                <td className="space-x-2 px-4 py-3">
                  <button className={secondaryButtonClass} onClick={() => void promote(employee, "dept_head")}>
                    Dept head
                  </button>
                  <button className={secondaryButtonClass} onClick={() => void promote(employee, "asset_manager")}>
                    Asset manager
                  </button>
                  <button className={secondaryButtonClass} onClick={() => void toggleEmployeeStatus(employee)}>
                    {employee.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                  <button className={secondaryButtonClass} onClick={() => void deleteEmployee(employee)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </DataTable>
        </>
      ) : null}
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
        <FormField label={label}>
          <input className={inputClass} name="name" required />
        </FormField>
      </div>
      <button disabled={isSubmitting} className={buttonClass}>
        {isSubmitting ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
