# PyMySQL provides a pure-Python MySQLdb-compatible driver on Windows/Python 3.14.
# اگر PyMySQL نصب باشد، به‌عنوان جایگزین MySQLdb معرفی می‌شود تا جنگو بتواند به MySQL وصل شود.
try:
    import pymysql
    pymysql.install_as_MySQLdb()
# اگر نصب نبود، خطایی نمی‌دهیم؛
except ImportError:
    # mysqlclient can still be used when installed separately.
    pass
