const knex = require("./src/database/connection");

async function checkData() {
  try {
    const rows = await knex("execucao2025")
      .where("unidade_gestora", "ILIKE", "150101%")
      .select("unidade_gestora", "despesas_empenhadas", "despesas_liquidadas", "despesas_pagas")
      .limit(10);
    
    console.log("Rows for 150101 in execucao2025:");
    console.table(rows);

    const summary = await knex("execucao2025")
      .where("unidade_gestora", "ILIKE", "150101%")
      .sum("despesas_empenhadas as empenhadas")
      .sum("despesas_liquidadas as liquidadas")
      .sum("despesas_pagas as pagas")
      .first();

    console.log("Summary for 150101 in execucao2025:");
    console.table(summary);

    const totalRows = await knex("execucao2025").count("* as count").first();
    console.log("Total rows in execucao2025:", totalRows.count);

    const ugs = await knex("execucao2025").distinct("unidade_gestora").select("unidade_gestora");
    console.log("Distinct UGs in execucao2025:", ugs.length);

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await knex.destroy();
  }
}

checkData();
