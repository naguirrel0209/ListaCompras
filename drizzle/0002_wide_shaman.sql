ALTER TABLE `shoppingItems` ADD `itemPriority` enum('critical','high','medium','low') DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `shoppingItems` ADD `deadline` timestamp;--> statement-breakpoint
ALTER TABLE `shoppingItems` ADD `note` varchar(300);--> statement-breakpoint
CREATE INDEX `shoppingItems_priority_idx` ON `shoppingItems` (`itemPriority`);