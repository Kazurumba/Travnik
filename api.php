<?php
ini_set('display_errors', 0);
ini_set('log_errors', 1);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

// Ловим фатальные ошибки PHP
register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR])) {
        http_response_code(500);
        echo json_encode(['success'=>false, 'error'=>'PHP Fatal: '.$error['message']], JSON_UNESCAPED_UNICODE);
    }
});

$host='127.0.0.1'; $db='travnik_db'; $user='root'; $pass='38elozesadh8pend';
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass,
        [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
    // Увеличиваем память для сортировки (решает ошибку 1038)
    $pdo->exec("SET SESSION sort_buffer_size = 16777216");
    $pdo->exec("SET SESSION max_length_for_sort_data = 4096");
} catch (Exception $e) {
    echo json_encode(['success'=>false, 'error'=>'DB Connect: '.$e->getMessage()], JSON_UNESCAPED_UNICODE); exit;
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: [];

function resp($d, $c=200){ http_response_code($c); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function getUser($pdo, $email){ 
    if(empty($email)) return null;
    $s=$pdo->prepare("SELECT * FROM users WHERE email=?"); $s->execute([$email]); return $s->fetch(); 
}

try {
    switch($action){
        case 'get_herbs':
            // БЕЗ ORDER BY - сортируем в PHP (защищает от ошибки 1038)
            $h = $pdo->query("SELECT * FROM herbs")->fetchAll();
            foreach($h as &$x){
                foreach(['parts','chemicals','vitamins','minerals','properties','indications','contraindications','photos'] as $f)
                    $x[$f] = json_decode($x[$f]??'[]', true) ?: [];
            }
            // Сортируем в PHP
            usort($h, function($a,$b){ return strcmp($a['name']??'', $b['name']??''); });
            resp(['success'=>true, 'data'=>$h]); 
            break;
            
        case 'get_posts':
            // БЕЗ ORDER BY - сортируем в PHP
            $posts = $pdo->query("SELECT p.*, u.name as author_name, u.avatar as author_avatar FROM posts p LEFT JOIN users u ON p.user_id=u.id")->fetchAll();
            $cid = null;
            if(!empty($input['user_email'])){ 
                $cu = getUser($pdo, $input['user_email']); 
                if($cu) $cid = $cu['id']; 
            }
            foreach($posts as &$p){
                // Безопасный decode images
                $imgs = $p['images'] ?? null;
                $p['images'] = [];
                if($imgs){
                    $decoded = @json_decode($imgs, true);
                    if(is_array($decoded)) $p['images'] = $decoded;
                }
                $c = $pdo->prepare("SELECT c.*, u.name as author_name, u.avatar as author_avatar FROM comments c LEFT JOIN users u ON c.user_id=u.id WHERE c.post_id=? ORDER BY c.created_at ASC");
                $c->execute([$p['id']]); 
                $p['comments'] = $c->fetchAll();
                $p['liked_by_me'] = false;
                if($cid){ 
                    $l = $pdo->prepare("SELECT COUNT(*) FROM post_likes WHERE user_id=? AND post_id=?"); 
                    $l->execute([$cid, $p['id']]); 
                    $p['liked_by_me'] = $l->fetchColumn() > 0; 
                }
            }
            // Сортируем в PHP по created_at
            usort($posts, function($a,$b){ 
                return strcmp($b['created_at']??'', $a['created_at']??''); 
            });
            resp(['success'=>true, 'data'=>$posts]); 
            break;

case 'update_post':
    $id = intval($data['id'] ?? 0);
    $email = $data['user_email'] ?? '';
    $text = $data['text'] ?? '';
    $images = isset($data['images']) && is_array($data['images']) ? json_encode($data['images']) : '[]';

    // Проверка владельца
    $user = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $user->execute([$email]);
    $u = $user->fetch();
    if (!$u) die(json_encode(['success'=>false,'error'=>'Пользователь не найден']));

    $post = $pdo->prepare("SELECT user_id FROM posts WHERE id = ?");
    $post->execute([$id]);
    $p = $post->fetch();
    if (!$p || $p['user_id'] != $u['id']) die(json_encode(['success'=>false,'error'=>'Нет прав']));

    $upd = $pdo->prepare("UPDATE posts SET text = ?, images = ? WHERE id = ?");
    $upd->execute([$text, $images, $id]);
    echo json_encode(['success'=>true]);
    break;
            
        case 'save_herb':
            $id = $input['id'] ?? null;
            foreach(['parts','chemicals','vitamins','minerals','properties','indications','contraindications','photos'] as $f)
                if(isset($input[$f])) $input[$f] = is_array($input[$f]) ? json_encode($input[$f]) : $input[$f];
            if(isset($input['latinName'])){ $input['latin_name']=$input['latinName']; unset($input['latinName']); }
            unset($input['id']);
            if($id){
                $f=[]; $v=[];
                foreach(['name','latin_name','type','parts','chemicals','vitamins','minerals','properties','indications','contraindications','preparation','harvest','notes','photos'] as $c)
                    if(isset($input[$c])){ $f[]="$c=?"; $v[]=$input[$c]; }
                if($f){
                    $v[]=$id; 
                    $pdo->prepare("UPDATE herbs SET ".implode(',',$f)." WHERE id=?")->execute($v);
                    resp(['success'=>true, 'id'=>$id]);
                }
                resp(['success'=>false, 'error'=>'Нет данных для обновления']);
            } else {
                $cols = implode(',', array_keys($input));
                $ph = implode(',', array_fill(0, count($input), '?'));
                $pdo->prepare("INSERT INTO herbs ($cols) VALUES ($ph)")->execute(array_values($input));
                resp(['success'=>true, 'id'=>$pdo->lastInsertId()]);
            }
            break;
            
        case 'delete_herb':
            $pdo->prepare("DELETE FROM herbs WHERE id=?")->execute([$input['id']??0]);
            resp(['success'=>true]); 
            break;
            
        case 'register':
            if(getUser($pdo, $input['email']??'')) resp(['success'=>false, 'error'=>'Email уже занят']);
            $pdo->prepare("INSERT INTO users(name,email,password) VALUES(?,?,?)")->execute([$input['name'],$input['email'],$input['pass']]);
            resp(['success'=>true, 'user'=>getUser($pdo, $input['email'])]); 
            break;
            
        case 'login':
            $u = getUser($pdo, $input['email']??'');
            if($u && $u['password']===$input['pass']) resp(['success'=>true, 'user'=>$u]);
            resp(['success'=>false, 'error'=>'Неверный email или пароль']); 
            break;
            
        case 'update_profile':
            $u = getUser($pdo, $input['email']??''); 
            if(!$u) resp(['success'=>false, 'error'=>'Пользователь не найден']);
            $f=[]; $v=[];
            foreach(['name','bio','city','status_msg','avatar'] as $x) 
                if(isset($input[$x])){ $f[]="$x=?"; $v[]=$input[$x]; }
            if($f){
                $v[]=$input['email'];
                $pdo->prepare("UPDATE users SET ".implode(',',$f)." WHERE email=?")->execute($v);
                resp(['success'=>true]);
            }
            resp(['success'=>false, 'error'=>'Нет данных']);
            break;
            
        case 'create_post':
            $u = getUser($pdo, $input['user_email']??''); 
            if(!$u) resp(['success'=>false, 'error'=>'Пользователь не найден']);
            $imgs = isset($input['images']) ? json_encode($input['images']) : null;
            $pdo->prepare("INSERT INTO posts(user_id,text,images) VALUES(?,?,?)")->execute([$u['id'], $input['text']??'', $imgs]);
            resp(['success'=>true, 'id'=>$pdo->lastInsertId()]); 
            break;
            
        case 'delete_post':
            $pdo->prepare("DELETE FROM posts WHERE id=?")->execute([$input['id']??0]); 
            resp(['success'=>true]); 
            break;
            
        case 'toggle_like':
            $u = getUser($pdo, $input['user_email']??''); 
            if(!$u) resp(['success'=>false, 'error'=>'Войдите']);
            $pid = $input['post_id']??0; $uid = $u['id'];
            $c = $pdo->prepare("SELECT id FROM post_likes WHERE user_id=? AND post_id=?"); 
            $c->execute([$uid, $pid]);
            if($c->fetch()){
                $pdo->prepare("DELETE FROM post_likes WHERE user_id=? AND post_id=?")->execute([$uid, $pid]);
                $pdo->prepare("UPDATE posts SET likes_count=GREATEST(0,likes_count-1) WHERE id=?")->execute([$pid]);
                resp(['success'=>true, 'liked'=>false]);
            } else {
                $pdo->prepare("INSERT INTO post_likes(user_id,post_id) VALUES(?,?)")->execute([$uid, $pid]);
                $pdo->prepare("UPDATE posts SET likes_count=likes_count+1 WHERE id=?")->execute([$pid]);
                resp(['success'=>true, 'liked'=>true]);
            }
            break;
            
        case 'add_comment':
            $u = getUser($pdo, $input['user_email']??''); 
            if(!$u) resp(['success'=>false, 'error'=>'Войдите']);
            $pdo->prepare("INSERT INTO comments(post_id,user_id,text) VALUES(?,?,?)")->execute([$input['post_id'], $u['id'], $input['text']]);
            resp(['success'=>true, 'comment_id'=>$pdo->lastInsertId()]); 
            break;
            
        // === НОВАЯ КОМАНДА: полная диагностика ===
        case 'diagnose':
            $result = ['success'=>true, 'tables'=>[], 'counts'=>[]];
            $tables = ['users','posts','post_likes','comments','herbs'];
            foreach($tables as $t){
                try {
                    $c = $pdo->query("SELECT COUNT(*) FROM $t")->fetchColumn();
                    $result['tables'][] = $t;
                    $result['counts'][$t] = $c;
                } catch(Exception $e){
                    $result['error_'.$t] = $e->getMessage();
                }
            }
            // Проверяем битые данные в posts
            $badPosts = $pdo->query("SELECT id, LENGTH(images) as img_size FROM posts WHERE images IS NOT NULL AND LENGTH(images) > 1000000")->fetchAll();
            $result['big_images_posts'] = $badPosts;
            resp($result);
            break;
            
        default: 
            resp(['success'=>false, 'error'=>'Неизвестное действие: '.$action], 404);
    }
} catch (Exception $e) {
    resp(['success'=>false, 'error'=>$e->getMessage(), 'action'=>$action], 500);
}