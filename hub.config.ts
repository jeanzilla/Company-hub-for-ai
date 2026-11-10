// Everything that changes from one company to another, in one place. The "new-hub" skill fills in this file.

export type MenuEntry = { href: string; title: string; icon: string; permission: string };

export const hub = {
  /** Name shown in the menu, on the sign-in screen and in the MCP. */
  name: "Hub",
  /** One line about the company. Connected AIs read it when they start. */
  description: "Internal company hub: tools, connectors, devices and an activity log.",
  /** Accent color, in hexadecimal. It is the only brand color in the whole interface. */
  color: "#2f5fd0",
  /** Areas of the log. They filter who touches what: name them with the company's own words. */
  areas: ["Sales", "Customers", "Operations", "Admin", "Marketing", "Website", "Hub", "Other"],
  /** The company's own screens. Each one asks for a permission; people without it do not see it in the menu. */
  menu: [] as MenuEntry[],
};
