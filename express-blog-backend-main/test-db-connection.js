
const mysql = require('mysql2');
const config = require('./config');

// 创建数据库连接
const connection = mysql.createConnection(config.mysql);

// 连接到数据库
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to database successfully!');

    // 检查 comments 表是否存在
    connection.query('SHOW TABLES LIKE "comments"', (err, results) => {
        if (err) {
            console.error('Error checking comments table:', err);
            return;
        }
        if (results.length > 0) {
            console.log('Comments table exists!');
        } else {
            console.log('Comments table does NOT exist!');
        }

        // 显示所有表
        connection.query('SHOW TABLES', (err, results) => {
            if (err) {
                console.error('Error showing tables:', err);
                return;
            }
            console.log('All tables:');
            results.forEach(table => {
                console.log('-', table[Object.keys(table)[0]]);
            });

            // 关闭连接
            connection.end();
        });
    });
});
